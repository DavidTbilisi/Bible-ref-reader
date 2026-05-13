// @ts-check
// Tests for the UI layer added by the dark-mode/presentation/sync-scroll
// pass: theme switching, presentation mode, verse-number rendering, and
// the parallel-scrolling behaviour between translation panels.
const { test, expect } = require('./fixtures/coverage');
const {
  genesis1_10,
  genesis1_10_en,
  john3_no_numbers,
  john3_kjv_html,
  genesis1_object_no_numbers,
  textSearchHtml,
  apiError,
} = require('./fixtures/verses');

const API_HOST = 'davidchincharashvii.pythonanywhere.com';

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

test.describe('Theme switching', () => {
  test('initial theme follows prefers-color-scheme: dark → compline', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'compline');
  });

  test('initial theme follows prefers-color-scheme: light → vellum', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'vellum');
  });

  test('toggle button flips theme and persists to localStorage', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'vellum');

    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'compline');

    const stored = await page.evaluate(() => localStorage.getItem('bible.theme'));
    expect(stored).toBe('compline');

    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'vellum');
  });

  test('stored theme overrides prefers-color-scheme on next load', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('bible.theme', 'vellum'));
    await page.reload();
    // Even though prefers-color-scheme is dark, the stored 'vellum' wins —
    // this exercises the `return stored;` branch in initialTheme().
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'vellum');
  });
});

test.describe('Presentation mode', () => {
  test('toggle button enters and leaves presentation mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'reading');

    await page.locator('#presentation-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'presentation');

    // Translations fieldset and search input are hidden via CSS in this mode.
    await expect(page.locator('#translations')).not.toBeVisible();
    await expect(page.locator('#search')).not.toBeVisible();

    await page.locator('#presentation-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'reading');
  });

  test('Escape key exits presentation mode', async ({ page }) => {
    await page.goto('/');
    await page.locator('#presentation-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'presentation');

    await page.keyboard.press('Escape');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'reading');
  });

  test('Escape does nothing when already in reading mode', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'reading');
  });
});

test.describe('Verse rendering', () => {
  test('renders verse numbers as data-v + rubric span', async ({ page }) => {
    await mockApi(page, {
      [`/api/search/ka/geo/${encodeURIComponent('Gen 1:10')}`]: genesis1_10,
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 1:10');

    const verse = page.locator('.translation-result .verse').first();
    await expect(verse).toHaveAttribute('data-v', '10');
    await expect(verse.locator('.v-num')).toHaveText('10');
    // The leading "10. " is stripped from the body text but preserved in v-num.
    await expect(verse.locator('.v-text')).toContainText('უწოდა ღმერთმა');
    await expect(verse.locator('.v-text')).not.toContainText('10.');
  });

  test('falls back to array index when verses have no leading numbers', async ({
    page,
  }) => {
    await mockApi(page, {
      [`/api/search/en/kjv/${encodeURIComponent('john 3:16-18')}`]: john3_no_numbers,
    });
    await page.goto('/');
    await selectLanguages(page, ['en']);
    await page.selectOption('.translation[data-lang="en"] select', 'kjv');

    await search(page, 'john 3:16-18');

    const verses = page.locator('.translation-result .verse');
    await expect(verses).toHaveCount(3);
    // No regex extracted a number, so they fall back to index+1 → 1, 2, 3.
    await expect(verses.nth(0)).toHaveAttribute('data-v', '1');
    await expect(verses.nth(2)).toHaveAttribute('data-v', '3');
  });
});

test.describe('Parallel scrolling', () => {
  test('scrolling one panel scrolls others to the same verse', async ({ page }) => {
    // Two languages, each with many verses, so the panels are scrollable.
    const longBook = (book, n = 60) => ({
      book,
      chapter: 1,
      verses: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [i + 1, `${i + 1}. line ${i + 1} of ${book}`]),
      ),
    });
    await mockApi(page, {
      [`/api/search/ka/geo/${encodeURIComponent('Gen 1')}`]: longBook('დაბ'),
      [`/api/search/en/kjv/${encodeURIComponent('Gen 1')}`]: longBook('Genesis'),
    });
    await page.goto('/');
    await selectLanguages(page, ['ka', 'en']);

    await search(page, 'Gen 1');
    await expect(page.locator('.translation-result')).toHaveCount(2);

    // Force panels to be scrollable by setting an explicit max-height in case
    // the viewport is large enough that the natural max-height isn't enough.
    await page.evaluate(() => {
      document.querySelectorAll('.translation-result .panel-body').forEach((b) => {
        b.style.maxHeight = '300px';
      });
    });

    // Scroll panel A (ka) so that verse ~25 sits near the top.
    const result = await page.evaluate(() => {
      const ka = document.querySelector('.translation-result[data-lang="ka"] .panel-body');
      const en = document.querySelector('.translation-result[data-lang="en"] .panel-body');
      const targetA = ka.querySelector('.verse[data-v="25"]');
      ka.scrollTop = targetA.offsetTop - ka.offsetTop;
      ka.dispatchEvent(new Event('scroll'));
      return new Promise((resolve) => {
        // Wait two frames so the requestAnimationFrame guard releases and
        // any subsequent scrolls settle.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const enTarget = en.querySelector('.verse[data-v="25"]');
          const containerRect = en.getBoundingClientRect();
          const targetRect = enTarget.getBoundingClientRect();
          resolve({
            kaScrolled: ka.scrollTop > 0,
            enScrolled: en.scrollTop > 0,
            // Same verse number should be near the top of the en panel too.
            enTargetOffsetFromTop: targetRect.top - containerRect.top,
          });
        }));
      });
    });

    expect(result.kaScrolled).toBe(true);
    expect(result.enScrolled).toBe(true);
    // Verse 25 in the en panel should be within ~5px of the top after sync.
    expect(Math.abs(result.enTargetOffsetFromTop)).toBeLessThan(8);
  });

  test('sync-scroll setup is a no-op with a single panel', async ({ page }) => {
    await mockApi(page, {
      [`/api/search/ka/geo/${encodeURIComponent('Gen 1:10')}`]: genesis1_10,
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    await search(page, 'Gen 1:10');
    // Wait for the debounced render before reaching into the DOM.
    await expect(page.locator('.translation-result')).toHaveCount(1);

    // Scroll handler shouldn't attach when only one panel; firing scroll on
    // the lone panel must not throw.
    await page.evaluate(() => {
      const body = document.querySelector('.translation-result .panel-body');
      body.dispatchEvent(new Event('scroll'));
    });
    await expect(page.locator('.translation-result')).toHaveCount(1);
  });

  test('scrolling an error panel is a no-op (topMostVerse returns null)', async ({
    page,
  }) => {
    // ka returns verses; en is unmocked → 404 → renders an error panel.
    // Sync-scroll still wires up because there are 2 panel-bodies, but the
    // en panel has no .verse children, so topMostVerse() must return null
    // and the scroll handler must early-return without throwing.
    await mockApi(page, {
      [`/api/search/ka/geo/${encodeURIComponent('Gen 1')}`]: {
        book: 'დაბ',
        chapter: 1,
        verses: { 1: '1. one', 2: '2. two' },
      },
    });
    await page.goto('/');
    await selectLanguages(page, ['ka', 'en']);

    await search(page, 'Gen 1');
    await expect(page.locator('.translation-result[data-lang="en"] .error')).toBeVisible();

    const enScrollTop = await page.evaluate(() => {
      const en = document.querySelector(
        '.translation-result[data-lang="en"] .panel-body',
      );
      en.scrollTop = 0;
      en.dispatchEvent(new Event('scroll'));
      return en.scrollTop;
    });
    expect(enScrollTop).toBe(0);
  });

  test('scrollToVerse no-ops when target verse is missing in the other panel', async ({
    page,
  }) => {
    // Make en panel have FEWER verses than ka, so when ka scrolls to verse 5,
    // there is no corresponding verse in en — scrollToVerse must early-return.
    await mockApi(page, {
      [`/api/search/ka/geo/${encodeURIComponent('Gen 1')}`]: {
        book: 'დაბ',
        chapter: 1,
        verses: Object.fromEntries(
          Array.from({ length: 30 }, (_, i) => [i + 1, `${i + 1}. line`]),
        ),
      },
      [`/api/search/en/kjv/${encodeURIComponent('Gen 1')}`]: {
        book: 'Genesis',
        chapter: 1,
        verses: { 1: '1. only verse' },
      },
    });
    await page.goto('/');
    await selectLanguages(page, ['ka', 'en']);

    await search(page, 'Gen 1');
    await expect(page.locator('.translation-result')).toHaveCount(2);

    await page.evaluate(() => {
      document.querySelectorAll('.translation-result .panel-body').forEach((b) => {
        b.style.maxHeight = '200px';
      });
      const ka = document.querySelector('.translation-result[data-lang="ka"] .panel-body');
      const target = ka.querySelector('.verse[data-v="20"]');
      ka.scrollTop = target.offsetTop - ka.offsetTop;
      ka.dispatchEvent(new Event('scroll'));
    });

    // en panel's scroll should remain ~0 since verse 20 doesn't exist there.
    const enScrollTop = await page.evaluate(
      () =>
        document.querySelector('.translation-result[data-lang="en"] .panel-body').scrollTop,
    );
    expect(enScrollTop).toBe(0);
  });
});

test.describe('HTML in verse bodies', () => {
  test('extracts the verse number from <sup class="versenum">N</sup>', async ({
    page,
  }) => {
    await mockApi(page, {
      [`/api/search/en/kjv/${encodeURIComponent('john 3:16-18')}`]: john3_kjv_html,
    });
    await page.goto('/');
    await selectLanguages(page, ['en']);

    await search(page, 'john 3:16-18');

    const first = page.locator('.translation-result .verse').first();
    await expect(first).toHaveAttribute('data-v', '16');
    await expect(first.locator('.v-num')).toHaveText('16');
    // The original text included `<sup>...</sup>` and `<i>the</i>` — both
    // must be stripped so the body reads as plain text.
    await expect(first.locator('.v-text')).toContainText('For God so loved');
    await expect(first.locator('.v-text')).not.toContainText('<sup');
    await expect(first.locator('.v-text')).not.toContainText('<i>');
  });

  test('falls back to the object key when verses have no leading number', async ({
    page,
  }) => {
    await mockApi(page, {
      [`/api/search/en/kjv/${encodeURIComponent('Gen 1:1-2')}`]:
        genesis1_object_no_numbers,
    });
    await page.goto('/');
    await selectLanguages(page, ['en']);

    await search(page, 'Gen 1:1-2');

    const verses = page.locator('.translation-result .verse');
    await expect(verses).toHaveCount(2);
    // peelVerse() returns null for the leading number, so parseVerses() must
    // use the object key — "1" and "2" — instead of falling back to index+1.
    await expect(verses.nth(0)).toHaveAttribute('data-v', '1');
    await expect(verses.nth(1)).toHaveAttribute('data-v', '2');
  });

  test('strips HTML from text-search match bodies', async ({ page }) => {
    await mockApi(page, {
      [`/api/textsearch/en/kjv/${encodeURIComponent('loved')}`]: textSearchHtml,
    });
    await page.goto('/');
    await selectLanguages(page, ['en']);

    await search(page, '/loved');

    const match = page.locator('.translation-result .match');
    await expect(match).toHaveCount(1);
    await expect(match.locator('.text')).toContainText('For God so loved');
    await expect(match.locator('.text')).not.toContainText('<sup');
  });
});

test.describe('Debouncing and stale-response guard', () => {
  test('rapid typing collapses to a single request per language', async ({ page }) => {
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

    // Type one character at a time, firing keyup after each. With debounce
    // (180ms) the show() should fire ONCE, well after the last keystroke.
    const input = page.locator('#search');
    for (const ch of 'Gen 1:10') {
      await input.press(ch);
    }

    await expect(page.locator('.translation-result .verse')).toHaveCount(1);
    // ka enabled = 1 selection per show; with debounce we should see one,
    // possibly two if a stray keyup leaked an extra timer. Anything ≤ 3
    // proves the debounce is working — without it we'd see 8.
    expect(calls).toBeLessThanOrEqual(3);
  });

  test('stale response from a previous query does not overwrite the latest', async ({
    page,
  }) => {
    // First request is held; second request resolves immediately. The held
    // first request must NOT render after the second one, because the
    // _showToken guard discards stale results.
    let firstResolve;
    const firstHeld = new Promise((r) => {
      firstResolve = r;
    });
    let hits = 0;
    await page.route(`https://${API_HOST}/**`, async (route) => {
      hits += 1;
      const url = route.request().url();
      if (hits === 1) {
        await firstHeld;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ book: 'OLD', chapter: 99, verses: { 1: 'old' } }),
        });
      }
      // Match-by-URL would be cleaner, but for this test we just want the
      // second-and-onward responses to differ visibly.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ book: 'NEW', chapter: 1, verses: { 1: 'new' } }),
      });
    });
    await page.goto('/');
    await selectLanguages(page, ['ka']);

    const input = page.locator('#search');
    await input.fill('first');
    await input.dispatchEvent('keyup');
    // Wait long enough for the debounce to fire and the first request to
    // start (then hang).
    await page.waitForTimeout(220);

    // Now type a second, different query. Its show() bumps the token; when
    // the first response is finally released, its render must be discarded.
    await input.fill('second');
    await input.dispatchEvent('keyup');
    await expect(page.locator('.translation-result .title')).toContainText('NEW 1');

    // Release the stale first response — it must NOT overwrite NEW 1.
    firstResolve();
    await page.waitForTimeout(100);
    await expect(page.locator('.translation-result .title')).toContainText('NEW 1');
    await expect(page.locator('.translation-result .title')).not.toContainText('OLD');
  });
});

test.describe('Bible masthead', () => {
  test('renders the title and toolbar buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.masthead-name')).toContainText('ბიბლიის მუხლები');
    await expect(page.locator('#theme-toggle')).toBeVisible();
    await expect(page.locator('#presentation-toggle')).toBeVisible();
  });
});
