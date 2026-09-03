import { useState } from 'react';

const tones = ['professional', 'casual', 'concise', 'creative'] as const;

export default function App() {
  const [tone, setTone] = useState<(typeof tones)[number]>('professional');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [result, setResult] = useState('');

  const handleRewrite = () => {
    const text = 'This email is a little rough and could be made more polished.';
    const next = `${text} -> ${tone} rewrite is ready.`;
    setResult(next);
  };

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h1>Smart Paraphraser</h1>
      <p>Standalone PWA shell for the shared writing assistant logic.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tones.map((option) => (
          <button key={option} onClick={() => setTone(option)}>{option}</button>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <label>API key</label>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key" style={{ display: 'block', width: '100%', marginTop: 8, marginBottom: 12 }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Model</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 8 }} />
      </div>
      <button onClick={handleRewrite}>Rewrite selection</button>
      <div style={{ marginTop: 20, background: '#f4f4f4', padding: 16, borderRadius: 12 }}>{result || 'Preview will appear here.'}</div>
    </main>
  );
}
