import { generateRewriteVariants } from '../../../src/lib/rewriteEngine';
import { analyzeLocalGrammar } from '../../../src/lib/localGrammar';
import type { Tone } from '../../../src/lib/types';

declare const Office: any;

const root = document.getElementById('root');

function render() {
  if (!root) return;
  root.innerHTML = `
    <div style="font-family: 'Segoe UI', sans-serif; padding: 16px; max-width: 420px;">
      <h2 style="margin-top:0;">Writing Assistant</h2>
      <label for="tone" style="display:block; margin-bottom:4px; font-weight:600;">Tone</label>
      <select id="tone" style="width:100%; padding:6px; margin-bottom:12px;">
        <option value="professional">Professional</option>
        <option value="casual">Casual</option>
        <option value="concise">Concise</option>
        <option value="creative">Creative</option>
      </select>
      <button id="analyze" style="width:100%; padding:8px; margin-bottom:8px;">Check grammar &amp; spelling</button>
      <button id="rewrite" style="width:100%; padding:8px;">Suggest rewrites for selection</button>
      <div id="status" style="margin-top:12px; color:#555; font-size:13px;"></div>
      <div id="result" style="margin-top:8px;"></div>
    </div>
  `;

  const status = document.getElementById('status')!;
  const result = document.getElementById('result')!;
  const toneSelect = document.getElementById('tone') as HTMLSelectElement;

  function getSelectedText(): Promise<string> {
    return new Promise((resolve, reject) => {
      Office.context.mailbox.item.getSelectedDataAsync(Office.CoercionType.Text, (res: any) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) resolve(res.value?.data ?? '');
        else reject(new Error(res.error?.message ?? 'Could not read selection'));
      });
    });
  }

  function getBodyText(): Promise<string> {
    return new Promise((resolve, reject) => {
      Office.context.mailbox.item.body.getAsync(Office.CoercionType.Text, (res: any) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) resolve(res.value ?? '');
        else reject(new Error(res.error?.message ?? 'Could not read body'));
      });
    });
  }

  function replaceSelection(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      Office.context.mailbox.item.setSelectedDataAsync(text, { coercionType: Office.CoercionType.Text }, (res: any) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) resolve();
        else reject(new Error(res.error?.message ?? 'Could not replace selection'));
      });
    });
  }

  document.getElementById('analyze')?.addEventListener('click', async () => {
    result.innerHTML = '';
    status.textContent = 'Analyzing message…';
    try {
      const text = await getBodyText();
      if (!text.trim()) {
        status.textContent = 'The message body is empty.';
        return;
      }
      const { issues, confidence } = analyzeLocalGrammar(text);
      status.textContent = issues.length
        ? `${issues.length} issue${issues.length === 1 ? '' : 's'} found (confidence ${(confidence * 100).toFixed(0)}%).`
        : 'No issues found. Looks good!';
      result.innerHTML = issues
        .slice(0, 20)
        .map(
          (i) =>
            `<div style="border-left:3px solid ${i.severity === 'high' ? '#dc2626' : i.severity === 'medium' ? '#d97706' : '#2563eb'}; padding:6px 8px; margin-bottom:6px; background:#f8fafc; font-size:13px;">
              ${i.message}${i.suggestions.length ? ` — try: <b>${i.suggestions[0]}</b>` : ''}
            </div>`,
        )
        .join('');
    } catch (err: any) {
      status.textContent = `Error: ${err.message}`;
    }
  });

  document.getElementById('rewrite')?.addEventListener('click', async () => {
    result.innerHTML = '';
    status.textContent = 'Reading selection…';
    try {
      let text = await getSelectedText();
      if (!text.trim()) text = await getBodyText();
      if (!text.trim()) {
        status.textContent = 'Select some text in your message first.';
        return;
      }
      const tone = toneSelect.value as Tone;
      const variants = generateRewriteVariants(text, tone);
      status.textContent = 'Pick a rewrite to insert:';
      result.innerHTML = '';
      variants.forEach((variant) => {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid #e2e8f0; border-radius:6px; padding:8px; margin-bottom:8px; font-size:13px;';
        const textEl = document.createElement('div');
        textEl.textContent = variant;
        const useBtn = document.createElement('button');
        useBtn.textContent = 'Insert';
        useBtn.style.cssText = 'margin-top:6px; padding:4px 12px;';
        useBtn.addEventListener('click', async () => {
          try {
            await replaceSelection(variant);
            status.textContent = 'Inserted.';
          } catch (err: any) {
            status.textContent = `Error: ${err.message}`;
          }
        });
        card.append(textEl, useBtn);
        result.appendChild(card);
      });
    } catch (err: any) {
      status.textContent = `Error: ${err.message}`;
    }
  });
}

if (typeof Office !== 'undefined' && Office.onReady) {
  Office.onReady(() => render());
} else {
  render();
}
