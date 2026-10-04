import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConnectionUI } from './ConnectionUI';

function App() {
  return (
    <main style={{ minWidth: 360, minHeight: 500, padding: 16, fontFamily: 'Segoe UI, sans-serif' }}>
      <ConnectionUI />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
