import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <main style={{ minWidth: 320, padding: 16, fontFamily: 'Segoe UI, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>Smart Paraphraser</h2>
      <p>Local grammar checks are active.</p>
      <div style={{ display: 'grid', gap: 8 }}>
        <button type="button">Professional</button>
        <button type="button">Casual</button>
        <button type="button">Concise</button>
        <button type="button">Creative</button>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
