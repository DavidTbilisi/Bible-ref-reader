// @ts-check
// Vim-like keyboard shortcuts: j/k for chapters, ]/[ for books, gg/G for
// first/last chapter, numeric prefixes, and `i` for entering insert mode.
const { test, expect } = require('./fixtures/coverage');

const API_HOST = 'davidchincharashvii.pythonanywhere.com';

/**
 * Catch-all mock: every request returns the same trivial verse payload.
 * KeyNav fires a fresh request per navigation; the specs assert on the
 * input value and the captured URLs rather than the rendered text.
 */
async function mockAny(page) {
  const seen = [];
  await page.route(`https://${API_HOST}/**`, (route) => {
    seen.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ book: 'mock', chapter: 1, verses: { 1: '1. mock' } }),
    });
  });
  return seen;
}

async function selectLanguages(page, langs) {
  await page.evaluate((wanted) => {
    document.querySelectorAll('#translations .translation').forEach((row) => {
      const cb = row.querySelector('input[type="checkbox"]');
      cb.checked = wanted.includes(row.dataset.lang);
    });
  }, langs);
}

async function search(page, text) {
  const input = page.locator('#search');
  await input.fill(text);
  await input.dispatchEvent('keyup');
  // After fill, the input retains focus — blur so the document-level
  // keydown listener actually sees key presses as navigation.
  await page.evaluate(() => document.activeElement.blur());
  await expect(page.locator('.translation-result')).toHaveCount(1);
}

test.describe('Vim-like shortcuts', () => {
  test('j advances chapter, k retreats it', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 1');

    await page.keyboard.press('j');
    await expect(page.locator('#search')).toHaveValue('Genesis 2');

    await page.keyboard.press('j');
    await expect(page.locator('#search')).toHaveValue('Genesis 3');

    await page.keyboard.press('k');
    await expect(page.locator('#search')).toHaveValue('Genesis 2');
  });

  test('numeric prefix multiplies the motion (5j → +5)', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 1');

    await page.keyboard.press('5');
    await page.keyboard.press('j');
    await expect(page.locator('#search')).toHaveValue('Genesis 6');

    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await page.keyboard.press('k');
    await expect(page.locator('#search')).toHaveValue('Genesis 1');
  });

  test('j clamps at the book end; k clamps at chapter 1', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 50');

    // Genesis has 50 chapters — pressing j should not advance past 50.
    await page.keyboard.press('j');
    await expect(page.locator('#search')).toHaveValue('Genesis 50');

    await search(page, 'Gen 1');
    await page.keyboard.press('k');
    await expect(page.locator('#search')).toHaveValue('Genesis 1');
  });

  test('] advances to the next book, [ goes back', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 25');

    await page.keyboard.press(']');
    await expect(page.locator('#search')).toHaveValue('Exodus 1');

    await page.keyboard.press('[');
    await expect(page.locator('#search')).toHaveValue('Genesis 1');
  });

  test('] and [ clamp at canon boundaries', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);

    await search(page, 'Rev 1');
    await page.keyboard.press(']');
    await expect(page.locator('#search')).toHaveValue('Revelation 1');

    await search(page, 'Gen 1');
    await page.keyboard.press('[');
    await expect(page.locator('#search')).toHaveValue('Genesis 1');
  });

  test('gg jumps to chapter 1; G jumps to the last chapter', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 25');

    await page.keyboard.press('g');
    await page.keyboard.press('g');
    await expect(page.locator('#search')).toHaveValue('Genesis 1');

    await page.keyboard.press('G');
    await expect(page.locator('#search')).toHaveValue('Genesis 50');

    // Prefixed G goes to a specific chapter.
    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await page.keyboard.press('G');
    await expect(page.locator('#search')).toHaveValue('Genesis 12');
  });

  test('a stray single g is harmless and does not commit anything', async ({ page }) => {
    const seen = await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 25');

    const before = seen.length;
    await page.keyboard.press('g');
    await page.waitForTimeout(50);
    // Single g doesn't change the input or trigger a request.
    await expect(page.locator('#search')).toHaveValue('Gen 25');
    expect(seen.length).toBe(before);
  });

  test('i focuses the search input (insert mode)', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 1');

    await page.keyboard.press('i');
    await expect(page.locator('#search')).toBeFocused();
    // The 'i' itself must not have leaked into the input.
    await expect(page.locator('#search')).toHaveValue('Gen 1');
  });

  test('shortcuts do not fire when the input is focused', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 1');

    await page.locator('#search').focus();
    await page.keyboard.press('j');
    // Typing 'j' inside the input appends literally instead of navigating.
    await expect(page.locator('#search')).toHaveValue('Gen 1j');
  });

  test('shortcuts no-op when no parseable reference is present', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await page.evaluate(() => document.activeElement.blur());

    // Empty input — nothing to navigate from.
    await page.keyboard.press('j');
    await expect(page.locator('#search')).toHaveValue('');

    // Text-search mode (leading /) — also nothing to navigate from.
    const input = page.locator('#search');
    await input.fill('/light');
    await input.dispatchEvent('keyup');
    await page.evaluate(() => document.activeElement.blur());

    await page.keyboard.press(']');
    await expect(page.locator('#search')).toHaveValue('/light');
  });

  test('Georgian reference keeps Georgian script after navigation', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['ka']);
    await search(page, 'დაბ 1');

    await page.keyboard.press('j');
    await expect(page.locator('#search')).toHaveValue('დაბ 2');
  });

  test('Russian reference keeps Cyrillic script after navigation', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['ru']);
    await search(page, 'Бытие 1');

    await page.keyboard.press('j');
    await expect(page.locator('#search')).toHaveValue('Бытие 2');
  });

  test('an unrelated key leaves the reference untouched', async ({ page }) => {
    const seen = await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 1');

    const before = seen.length;
    await page.keyboard.press('x');
    await page.waitForTimeout(50);
    await expect(page.locator('#search')).toHaveValue('Gen 1');
    expect(seen.length).toBe(before);
  });

  test('modifier keys do not trigger navigation', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 1');

    await page.keyboard.press('Control+j');
    await expect(page.locator('#search')).toHaveValue('Gen 1');
  });

  test('verse range is dropped when jumping chapters', async ({ page }) => {
    await mockAny(page);
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await search(page, 'Gen 1:10-16');

    await page.keyboard.press('j');
    await expect(page.locator('#search')).toHaveValue('Genesis 2');
  });
});
