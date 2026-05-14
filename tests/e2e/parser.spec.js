// @ts-check
const { test, expect } = require('./fixtures/coverage');
const {
  genesis1_10,
  genesis1_10_en,
  genesis1_10_ru,
  genesis1_10_to_12,
  psalm23_array,
  psalm23_string,
  genesis1_full,
  textSearchResults,
  textSearchEmpty,
  apiError,
} = require('./fixtures/verses');

const API_HOST = 'davidchincharashvii.pythonanywhere.com';

/**
 * Install a fetch interceptor matching by exact pathname. Anything
 * unregistered returns 404 with the API's error-shape body, so the
 * UI's error-rendering path stays exercisable.
 */
async function mockApi(page, routes) {
  await page.route(`https://${API_HOST}/**`, (route) => {
    const url = new URL(route.request().url());
    const match = routes[url.pathname];
    if (match) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(match),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify(apiError),
    });
  });
}

async function search(page, text) {
  const input = page.locator('#search');
  await input.fill(text);
  await input.dispatchEvent('keyup');
}

async function selectLanguages(page, langs) {
  await page.evaluate((wanted) => {
    document.querySelectorAll('#translations .translation').forEach((row) => {
      const cb = row.querySelector('input[type="checkbox"]');
      cb.checked = wanted.includes(row.dataset.lang);
    });
  }, langs);
}

test.describe('Bible ref reader (mocked API)', () => {
  test('loads with empty input and no result', async ({ page }) => {
    await mockApi(page, {});
    await page.goto('/');
    await expect(page.locator('#search')).toHaveValue('');
    await expect(page.locator('#result')).toBeEmpty();
  });

  test('reference parses client-side and uses direct lookup', async ({ page }) => {
    // "Gen 1:10" → Genesis (id 1) chapter 1 verse 10 → /api/ka/geo/1/1/10
    // No /api/search/ involved — direct lookup is the primary path.
    await mockApi(page, {
      '/api/ka/geo/1/1/10': genesis1_10,
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 1:10');

    await expect(page.locator('.translation-result[data-lang="ka"] .title')).toHaveText(
      'დაბ 1',
    );
    await expect(page.locator('.translation-result[data-lang="ka"] .verse')).toHaveCount(1);
  });

  test('renders multiple translations in parallel panels', async ({ page }) => {
    await mockApi(page, {
      '/api/ka/geo/1/1/10': genesis1_10,
      '/api/en/kjv/1/1/10': genesis1_10_en,
    });
    await page.goto('/');
    await selectLanguages(page, ['ka', 'en']);

    await search(page, 'Gen 1:10');

    await expect(page.locator('.translation-result')).toHaveCount(2);
    await expect(page.locator('.translation-result[data-lang="ka"] .title')).toHaveText(
      'დაბ 1',
    );
    await expect(page.locator('.translation-result[data-lang="en"] .title')).toHaveText(
      'Genesis 1',
    );
    await expect(page.locator('.translation-result[data-lang="en"] .verse')).toContainText(
      'dry land',
    );
  });

  test('renders ka, en, and ru in parallel from one query', async ({ page }) => {
    await mockApi(page, {
      '/api/ka/geo/1/1/10': genesis1_10,
      '/api/en/kjv/1/1/10': genesis1_10_en,
      '/api/ru/rusv/1/1/10': genesis1_10_ru,
    });
    await page.goto('/');
    await selectLanguages(page, ['ka', 'en', 'ru']);

    await search(page, 'Gen 1:10');

    await expect(page.locator('.translation-result')).toHaveCount(3);
    await expect(page.locator('.translation-result[data-lang="ka"] .verse')).toContainText(
      'უწოდა ღმერთმა',
    );
    await expect(page.locator('.translation-result[data-lang="en"] .verse')).toContainText(
      'dry land',
    );
    await expect(page.locator('.translation-result[data-lang="ru"] .title')).toHaveText(
      'Бытие 1',
    );
    await expect(page.locator('.translation-result[data-lang="ru"] .verse')).toContainText(
      'назвал Бог сушу землею',
    );
  });

  test('Russian version swap (rusv → bti) re-fires under /api/ru/bti/', async ({
    page,
  }) => {
    const seen = [];
    await page.route(`https://${API_HOST}/**`, (route) => {
      seen.push(new URL(route.request().url()).pathname);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(genesis1_10_ru),
      });
    });
    await page.goto('/');
    await selectLanguages(page, ['ru']);

    await search(page, 'быт 1:10');
    await page.selectOption('.translation[data-lang="ru"] select', 'bti');

    await expect.poll(() => seen.some((p) => p.startsWith('/api/ru/bti/'))).toBe(true);
  });

  test('renders verses as object, array, and string shapes', async ({ page }) => {
    await mockApi(page, {
      '/api/ka/geo/1/1/10/12': genesis1_10_to_12,
      '/api/ka/geo/19/23/1/2': psalm23_array,
      '/api/ka/geo/19/23/1': psalm23_string,
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 1:10-12');
    await expect(page.locator('.translation-result .verse')).toHaveCount(3);

    await search(page, 'Ps 23:1-2');
    await expect(page.locator('.translation-result .verse')).toHaveCount(2);

    await search(page, 'Ps 23:1');
    await expect(page.locator('.translation-result .verse')).toHaveCount(1);
    await expect(page.locator('.translation-result .verse').first()).toContainText(
      'არაფერი მაკლია',
    );
  });

  test('handles a whole-chapter query (no verse number)', async ({ page }) => {
    await mockApi(page, {
      '/api/ka/geo/1/1': genesis1_full,
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 1');

    await expect(page.locator('.translation-result .title')).toHaveText('დაბ 1');
    await expect(page.locator('.translation-result .verse')).toHaveCount(2);
  });

  test('shows the API error message verbatim when the server returns one', async ({
    page,
  }) => {
    await mockApi(page, {});
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 99:1');

    await expect(page.locator('.translation-result .error')).toHaveText(
      'Chapter 99 does not exist in the Bible',
    );
  });

  test('text-search mode is triggered by a leading slash', async ({ page }) => {
    const seen = [];
    await page.route(`https://${API_HOST}/**`, (route) => {
      seen.push(new URL(route.request().url()).pathname);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(textSearchResults),
      });
    });
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await page.selectOption('.translation[data-lang="en"] select', 'kjv');

    await search(page, '/beginning');

    await expect(page.locator('.translation-result .match')).toHaveCount(2);
    await expect(page.locator('.translation-result .match').first()).toContainText(
      'In the beginning God',
    );
    expect(seen).toContain(`/api/textsearch/en/kjv/${encodeURIComponent('beginning')}`);
  });

  test('text-search with zero matches shows the empty-state message', async ({ page }) => {
    await mockApi(page, {
      [`/api/textsearch/ka/geo/${encodeURIComponent('xyzqq')}`]: textSearchEmpty,
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, '/xyzqq');

    await expect(page.locator('.translation-result .error')).toHaveText('No matches.');
  });

  test('caps text-search rendering at the first 50 matches', async ({ page }) => {
    const many = {
      matches: Array.from({ length: 73 }, (_, i) => ({
        book: 'Genesis',
        chapter: 1,
        verse: i + 1,
        text: `verse ${i + 1}`,
        link: `https://${API_HOST}/api/en/kjv/1/1/${i + 1}`,
      })),
    };
    await mockApi(page, {
      [`/api/textsearch/ka/geo/${encodeURIComponent('verse')}`]: many,
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, '/verse');

    await expect(page.locator('.translation-result .match')).toHaveCount(50);
    await expect(page.locator('.translation-result .more')).toContainText('+23 more');
    await expect(page.locator('.translation-result .more')).toContainText('refine your search');
    await expect(page.locator('.translation-result .count')).toContainText('73 matches');
  });

  test('text-search match count is singular for one result', async ({ page }) => {
    await mockApi(page, {
      [`/api/textsearch/ka/geo/${encodeURIComponent('q')}`]: {
        matches: [textSearchResults.matches[0]],
      },
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, '/q');

    await expect(page.locator('.translation-result .count')).toHaveText('1 match');
  });

  test('shows an error panel on network failure', async ({ page }) => {
    await page.route(`https://${API_HOST}/**`, (route) => route.abort('failed'));
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 1:10');

    await expect(page.locator('.translation-result .error')).toHaveText('Request failed.');
  });

  test('warns when no translations are enabled', async ({ page }) => {
    await mockApi(page, {});
    await page.goto('/');
    await selectLanguages(page, []);

    await search(page, 'Gen 1:10');

    await expect(page.locator('#result .error')).toHaveText(
      'Select at least one translation.',
    );
  });

  test('whitespace-only after a slash does not fire a request', async ({ page }) => {
    let calls = 0;
    await page.route(`https://${API_HOST}/**`, (route) => {
      calls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    });
    await page.goto('/');

    await search(page, '/   ');

    // Wait past the debounce so the show() handler actually runs and the
    // "empty query after slicing the slash" early-return is exercised.
    await page.waitForTimeout(300);
    expect(calls).toBe(0);
    await expect(page.locator('#result')).toBeEmpty();
  });

  test('shows Loading state in each panel before the response arrives', async ({ page }) => {
    let release;
    const held = new Promise((r) => {
      release = r;
    });
    await page.route(`https://${API_HOST}/**`, async (route) => {
      await held;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(genesis1_10),
      });
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 1:10');

    await expect(page.locator('.translation-result .title')).toHaveText('Loading…');
    release();
    await expect(page.locator('.translation-result .verse')).toHaveCount(1);
  });

  test('clearing the input wipes the result and stops firing requests', async ({ page }) => {
    let calls = 0;
    await page.route(`https://${API_HOST}/**`, (route) => {
      calls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(genesis1_10),
      });
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 1:10');
    await expect(page.locator('.translation-result .verse')).toHaveCount(1);

    const before = calls;
    const input = page.locator('#search');
    await input.fill('');
    await input.dispatchEvent('keyup');

    await expect(page.locator('#result')).toBeEmpty();
    await page.waitForTimeout(300);
    expect(calls).toBe(before);
  });

  test('updates document.title in both reference and text-search modes', async ({ page }) => {
    await mockApi(page, {
      '/api/ka/geo/1/1/10': genesis1_10,
      [`/api/textsearch/ka/geo/${encodeURIComponent('light')}`]: textSearchResults,
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 1:10');
    await expect(page).toHaveTitle('დაბ 1');

    await search(page, '/light');
    await expect(page).toHaveTitle('Search: light');
  });

  test('changing the version selector re-fires the request', async ({ page }) => {
    const seen = [];
    await page.route(`https://${API_HOST}/**`, (route) => {
      seen.push(new URL(route.request().url()).pathname);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(genesis1_10),
      });
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 1:10');
    await page.selectOption('.translation[data-lang="ka"] select', 'orthodox');

    await expect.poll(() => seen.some((p) => p.startsWith('/api/ka/orthodox/'))).toBe(true);
  });
});
