import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cosineSimilarity } from './ollama.js';

function envNumber(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function envFlag(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === '') {
    return fallback;
  }
  return !['false', '0', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

export const DEFAULT_SEMANTIC_CACHE_PATH = process.env.SEMANTIC_CACHE_PATH
  ? path.resolve(process.env.SEMANTIC_CACHE_PATH)
  : fileURLToPath(new URL('.cache/semantic-cache.json', import.meta.url));

const DEFAULT_THRESHOLD = envNumber('SEMANTIC_CACHE_THRESHOLD', 0.93);
const DEFAULT_MAX_ENTRIES = envNumber('SEMANTIC_CACHE_MAX_ENTRIES', 250);
const DEFAULT_PERSIST_ENABLED = envFlag('SEMANTIC_CACHE_PERSIST', true);
// Fuzzy (embedding-free) similarity threshold; 0 disables fuzzy matching.
const DEFAULT_FUZZY_THRESHOLD = (() => {
  const raw = Number(process.env.SEMANTIC_CACHE_FUZZY_THRESHOLD);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0.85;
})();

function hashText(value) {
  return createHash('sha1').update(String(value)).digest('hex');
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Lightweight word-overlap (Sørensen–Dice) similarity. Lets the cache answer reworded
 * requests without loading any embedding model — zero memory cost.
 */
export function textSimilarity(a, b) {
  const left = normalizeText(a).toLowerCase();
  const right = normalizeText(b).toLowerCase();
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }

  const leftWords = Array.from(new Set(left.split(' ')));
  const rightWords = Array.from(new Set(right.split(' ')));
  const rightSet = new Set(rightWords);
  let common = 0;
  for (const word of leftWords) {
    if (rightSet.has(word)) {
      common += 1;
    }
  }

  return (2 * common) / (leftWords.length + rightWords.length);
}

/**
 * Response cache for the local AI engine.
 *
 * - Exact matches are answered from a normalized text hash (works even without Ollama).
 * - Fuzzy matches answer near-identical rewordings via word-overlap similarity
 *   (no model required, zero memory cost).
 * - When an embedding model is configured (`OLLAMA_EMBED_MODEL`), embedding-based
 *   semantic matches are used as well (cosine similarity >= threshold).
 * - Entries are capped (LRU eviction by last use) and optionally persisted to disk so
 *   the cached AI engine stays warm across gateway restarts.
 */
export class SemanticCache {
  constructor(options = {}) {
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this.fuzzyThreshold = options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD;
    this.maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
    this.persistPath = options.persistPath !== undefined
      ? options.persistPath
      : (DEFAULT_PERSIST_ENABLED ? DEFAULT_SEMANTIC_CACHE_PATH : null);
    this.debounceMs = options.debounceMs ?? 400;
    this.entries = new Map();
    this.stats = { hits: 0, exactHits: 0, semanticHits: 0, fuzzyHits: 0, misses: 0, stores: 0 };
    this.saveTimer = null;
  }

  get size() {
    return this.entries.size;
  }

  buildKey(tone, fidelity, length, text) {
    // Case-insensitive so re-submitting the same text with different casing still hits.
    return hashText(`${tone}::${fidelity}::${length}::${normalizeText(text).toLowerCase()}`);
  }

  load() {
    if (!this.persistPath) {
      return 0;
    }

    try {
      const raw = readFileSync(this.persistPath, 'utf8');
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed?.entries) ? parsed.entries : [];

      for (const item of list) {
        if (!item || typeof item !== 'object') {
          continue;
        }

        const text = normalizeText(item.text);
        const variants = Array.isArray(item.variants)
          ? item.variants.map((value) => String(value ?? '').trim()).filter(Boolean)
          : [];

        if (!text || variants.length === 0 || !item.tone) {
          continue;
        }

        const tone = String(item.tone);
        const fidelity = String(item.fidelity ?? 'balanced');
        const length = String(item.length ?? 'same');
        const embedding = Array.isArray(item.embedding)
          ? item.embedding.map((value) => Number(value)).filter((value) => Number.isFinite(value))
          : [];

        this.entries.set(this.buildKey(tone, fidelity, length, text), {
          tone,
          fidelity,
          length,
          text,
          embedding: embedding.length > 0 ? embedding : null,
          variants,
          model: String(item.model ?? ''),
          createdAt: Number(item.createdAt) || Date.now(),
          lastUsed: Number(item.lastUsed) || Date.now(),
          hits: Number(item.hits) || 0,
        });
      }

      this.#evictOverflow();
      return this.entries.size;
    } catch {
      return 0;
    }
  }

  /**
   * Looks up a rewrite result. Returns `{ variants, model, kind, similarity }` or null.
   * `kind` is `exact` (identical request) or `semantic` (reworded request above threshold).
   */
  lookup(request = {}) {
    const text = normalizeText(request.text);
    if (!text) {
      return null;
    }

    const tone = String(request.tone ?? 'professional');
    const fidelity = String(request.fidelity ?? 'balanced');
    const length = String(request.length ?? 'same');
    const key = this.buildKey(tone, fidelity, length, text);

    const exact = this.entries.get(key);
    if (exact) {
      this.#touch(exact);
      this.stats.hits += 1;
      this.stats.exactHits += 1;
      return { variants: exact.variants, model: exact.model, kind: 'exact', similarity: 1 };
    }

    const embedding = Array.isArray(request.embedding) ? request.embedding : null;
    if (embedding) {
      let bestEntry = null;
      let bestScore = this.threshold;

      for (const entry of this.entries.values()) {
        if (entry.tone !== tone || entry.fidelity !== fidelity || entry.length !== length) {
          continue;
        }
        if (!Array.isArray(entry.embedding)) {
          continue;
        }

        const score = cosineSimilarity(embedding, entry.embedding);
        if (score >= bestScore) {
          bestEntry = entry;
          bestScore = score;
        }
      }

      if (bestEntry) {
        this.#touch(bestEntry);
        this.stats.hits += 1;
        this.stats.semanticHits += 1;
        return {
          variants: bestEntry.variants,
          model: bestEntry.model,
          kind: 'semantic',
          similarity: Number(bestScore.toFixed(4)),
        };
      }
    }

    // Fuzzy fallback: near-identical rewordings match without any embedding model.
    if (this.fuzzyThreshold > 0) {
      let bestEntry = null;
      let bestScore = this.fuzzyThreshold;

      for (const entry of this.entries.values()) {
        if (entry.tone !== tone || entry.fidelity !== fidelity || entry.length !== length) {
          continue;
        }

        const score = textSimilarity(text, entry.text);
        if (score >= bestScore) {
          bestEntry = entry;
          bestScore = score;
        }
      }

      if (bestEntry) {
        this.#touch(bestEntry);
        this.stats.hits += 1;
        this.stats.fuzzyHits += 1;
        return {
          variants: bestEntry.variants,
          model: bestEntry.model,
          kind: 'fuzzy',
          similarity: Number(bestScore.toFixed(4)),
        };
      }
    }

    this.stats.misses += 1;
    return null;
  }

  store(request = {}) {
    const text = normalizeText(request.text);
    const variants = Array.isArray(request.variants)
      ? request.variants.map((value) => String(value ?? '').trim()).filter(Boolean)
      : [];

    if (!text || variants.length === 0) {
      return false;
    }

    const tone = String(request.tone ?? 'professional');
    const fidelity = String(request.fidelity ?? 'balanced');
    const length = String(request.length ?? 'same');
    const embedding = Array.isArray(request.embedding)
      ? request.embedding.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : null;
    const now = Date.now();
    const key = this.buildKey(tone, fidelity, length, text);

    this.entries.delete(key);
    this.entries.set(key, {
      tone,
      fidelity,
      length,
      text,
      embedding: embedding && embedding.length > 0 ? embedding : null,
      variants,
      model: String(request.model ?? ''),
      createdAt: now,
      lastUsed: now,
      hits: 0,
    });
    this.stats.stores += 1;

    this.#evictOverflow();
    this.#scheduleSave();
    return true;
  }

  save() {
    if (!this.persistPath) {
      return false;
    }

    try {
      mkdirSync(path.dirname(this.persistPath), { recursive: true });
      const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        threshold: this.threshold,
        entries: Array.from(this.entries.values()),
      };
      const tmpPath = `${this.persistPath}.${process.pid}.tmp`;
      writeFileSync(tmpPath, JSON.stringify(payload));
      renameSync(tmpPath, this.persistPath);
      return true;
    } catch {
      return false;
    }
  }

  snapshot() {
    return {
      enabled: true,
      threshold: this.threshold,
      fuzzyThreshold: this.fuzzyThreshold,
      maxEntries: this.maxEntries,
      size: this.entries.size,
      persist: Boolean(this.persistPath),
      hits: this.stats.hits,
      exactHits: this.stats.exactHits,
      semanticHits: this.stats.semanticHits,
      fuzzyHits: this.stats.fuzzyHits,
      misses: this.stats.misses,
      stores: this.stats.stores,
    };
  }

  #touch(entry) {
    entry.lastUsed = Date.now();
    entry.hits += 1;
    this.#scheduleSave();
  }

  #evictOverflow() {
    while (this.entries.size > this.maxEntries) {
      let oldestKey = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.entries.entries()) {
        if (entry.lastUsed < oldestTime) {
          oldestTime = entry.lastUsed;
          oldestKey = key;
        }
      }

      if (!oldestKey) {
        break;
      }

      this.entries.delete(oldestKey);
    }
  }

  #scheduleSave() {
    if (!this.persistPath) {
      return;
    }

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, this.debounceMs);

    if (typeof this.saveTimer.unref === 'function') {
      this.saveTimer.unref();
    }
  }
}