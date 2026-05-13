// @ts-check
// Direct tests for Bible.js methods that aren't reachable purely through
// the DOM (custom lang/version overrides, the legacy direct-lookup paths,
// per-call URL construction).
const { test, expect } = require('./fixtures/coverage');

const API_HOST = 'davidchincharashvii.pythonanywhere.com';

async function captureGet(page, fn) {
  const seen = [];
  await page.route(`https://${API_HOST}/**`, (route) => {
    seen.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto('/');
  await fn();
  return seen;
}

test.describe('Bible (direct)', () => {
  test('constructor accepts {lang, version} and builds baseURL', async ({ page }) => {
    await page.goto('/');
    const url = await page.evaluate(async () => {
      const { default: Bible } = await import('/Bible.js');
      const b = new Bible({ lang: 'en', version: 'kjv' });
      return b.baseURL;
    });
    expect(url).toBe(`https://${API_HOST}/api/en/kjv`);
  });

  test('setLanguage / setVersion rebuild baseURL (with default-arg branch)', async ({
    page,
  }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const { default: Bible } = await import('/Bible.js');
      const b = new Bible();
      const before = b.baseURL;
      b.setLanguage('en');
      const afterLang = b.baseURL;
      b.setVersion('kjv');
      const afterVersion = b.baseURL;
      // Default-argument paths (no args) — exercises the "= 'ka' / 'geo'" defaults.
      b.setLanguage();
      b.setVersion();
      const afterReset = b.baseURL;
      return { before, afterLang, afterVersion, afterReset };
    });

    expect(result.before).toBe(`https://${API_HOST}/api/ka/geo`);
    expect(result.afterLang).toBe(`https://${API_HOST}/api/en/geo`);
    expect(result.afterVersion).toBe(`https://${API_HOST}/api/en/kjv`);
    expect(result.afterReset).toBe(`https://${API_HOST}/api/ka/geo`);
  });

  test('getVerses with each switch arity hits the right URL', async ({ page }) => {
    const seen = await captureGet(page, async () => {
      await page.evaluate(async () => {
        const { default: Bible } = await import('/Bible.js');
        const b = new Bible();
        // case 2 → switch default — URL is the bare base.
        await b.getVerses({ bookId: 1 });
        // case 3 → /book/chapter
        await b.getVerses({ bookId: 1, bookName: 'დაბ', chapter: 2 });
        // case 4 → /book/chapter/verse
        await b.getVerses({ bookId: 1, bookName: 'დაბ', chapter: 2, verseStart: 5 });
        // case 5 → /book/chapter/start/end
        await b.getVerses({
          bookId: 1,
          bookName: 'დაბ',
          chapter: 2,
          verseStart: 5,
          verseEnd: 7,
        });
      });
    });

    expect(seen).toContain('/api/ka/geo');
    expect(seen).toContain('/api/ka/geo/1/2');
    expect(seen).toContain('/api/ka/geo/1/2/5');
    expect(seen).toContain('/api/ka/geo/1/2/5/7');
  });

  test('parseReference uses /api/search/ and honors per-call overrides', async ({
    page,
  }) => {
    const seen = await captureGet(page, async () => {
      await page.evaluate(async () => {
        const { default: Bible } = await import('/Bible.js');
        const b = new Bible();
        await b.parseReference('john 3:16'); // defaults to ka/geo
        await b.parseReference('john 3:16', { lang: 'en', version: 'kjv' });
      });
    });

    expect(seen).toContain(`/api/search/ka/geo/${encodeURIComponent('john 3:16')}`);
    expect(seen).toContain(`/api/search/en/kjv/${encodeURIComponent('john 3:16')}`);
  });

  test('textSearch uses /api/textsearch/ and honors per-call overrides', async ({
    page,
  }) => {
    const seen = await captureGet(page, async () => {
      await page.evaluate(async () => {
        const { default: Bible } = await import('/Bible.js');
        const b = new Bible();
        await b.textSearch('beginning');
        await b.textSearch('начало', { lang: 'ru', version: 'rusv' });
      });
    });

    expect(seen).toContain(`/api/textsearch/ka/geo/${encodeURIComponent('beginning')}`);
    expect(seen).toContain(`/api/textsearch/ru/rusv/${encodeURIComponent('начало')}`);
  });
});
