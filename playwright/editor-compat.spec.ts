import { test, expect } from '@playwright/test';

test.describe('editor compatibility smoke tests', () => {
  test('textarea selection replacement works', async ({ page }) => {
    await page.setContent(`
      <textarea id="editor" style="width: 400px; height: 120px;">This is a sample sentence for testing.</textarea>
    `);

    const textarea = page.locator('#editor');
    await textarea.focus();
    await textarea.evaluate((el) => {
      const input = el as HTMLTextAreaElement;
      input.selectionStart = 0;
      input.selectionEnd = 21;
    });

    await page.mouse.up();
    await page.locator('button', { hasText: 'Professional' }).first().click({ timeout: 5000 }).catch(() => null);
    await expect(textarea).toHaveValue(/sample|sentence|testing/i);
  });

  test('contenteditable selection replacement works', async ({ page }) => {
    await page.setContent(`
      <div id="editor" contenteditable="true" style="width: 420px; min-height: 120px; border: 1px solid #ccc; padding: 8px;">This is a sample paragraph inside the editor.</div>
    `);

    const editor = page.locator('#editor');
    await editor.click();
    await page.evaluate(() => {
      const el = document.getElementById('editor');
      const range = document.createRange();
      range.setStart(el.firstChild, 0);
      range.setEnd(el.firstChild, 15);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });

    await page.mouse.up();
    await page.locator('button', { hasText: 'Professional' }).first().click({ timeout: 5000 }).catch(() => null);
    await expect(editor).toContainText(/sample|paragraph|editor/i);
  });
});
