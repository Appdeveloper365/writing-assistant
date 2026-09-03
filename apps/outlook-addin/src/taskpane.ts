const root = document.getElementById('root');
if (root) {
  root.innerHTML = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 400px;">
      <h2>Writing Assistant</h2>
      <p>Outlook add-in shell for the shared writing assistant core.</p>
      <button id="rewrite">Rewrite selected text</button>
      <div id="result" style="margin-top: 16px;"></div>
    </div>
  `;
  const button = document.getElementById('rewrite');
  const result = document.getElementById('result');
  button?.addEventListener('click', async () => {
    const selected = 'This draft could be made clearer and more professional.';
    if (result) result.textContent = `Preview: ${selected}`;
  });
}
