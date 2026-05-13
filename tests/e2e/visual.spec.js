// @ts-check
// Visual regression: 2 themes (vellum/compline) × 2 layouts (1-panel/3-panel)
// × 2 modes (normal/presentation) = 8 baselines.
//
// Baselines are Linux-only (committed under *-snapshots/). Tests skip on
// other platforms so contributors on macOS/Windows still get a green local
// run; regenerating baselines requires the Playwright Docker image or CI.
const { test, expect } = require('./fixtures/coverage');
const {
  genesis1_10_to_12,
  apiError,
} = require('./fixtures/verses');

const API_HOST = 'davidchincharashvii.pythonanywhere.com';

test.skip(process.platform !== 'linux', 'visual baselines are committed for linux only');

const genesis1_10_to_12_en = {
  book: 'Genesis',
  chapter: 1,
  verses: {
    10: '10. And God called the dry land Earth, and the gathering together of the waters called he Seas: and God saw that it was good.',
    11: '11. And God said, Let the earth bring forth grass, the herb yielding seed, and the fruit tree yielding fruit after his kind.',
    12: '12. And the earth brought forth grass, and herb yielding seed after his kind, and the tree yielding fruit.',
  },
};

const genesis1_10_to_12_ru = {
  book: 'Бытие',
  chapter: 1,
  verses: {
    10: '10. И назвал Бог сушу землею, а собрание вод назвал морями. И увидел Бог, что это хорошо.',
    11: '11. И сказал Бог: да произрастит земля зелень, траву, сеющую семя дерево плодовитое.',
    12: '12. И произвела земля зелень, траву, сеющую семя по роду ее, и дерево, приносящее плод.',
  },
};

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

async function setupPage(page, { theme, mode, langs }) {
  await page.goto('/');
  await page.evaluate(
    ({ theme, mode, langs }) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.mode = mode;
      document.querySelectorAll('#translations .translation').forEach((row) => {
        const cb = row.querySelector('input[type="checkbox"]');
        cb.checked = langs.includes(row.dataset.lang);
      });
    },
    { theme, mode, langs },
  );
}

async function search(page, text) {
  const input = page.locator('#search');
  await input.fill(text);
  await input.dispatchEvent('keyup');
}

const ONE_PANEL_ROUTES = {
  '/api/ka/geo/1/1/10/12': genesis1_10_to_12,
};

const THREE_PANEL_ROUTES = {
  '/api/ka/geo/1/1/10/12': genesis1_10_to_12,
  '/api/en/kjv/1/1/10/12': genesis1_10_to_12_en,
  '/api/ru/rusv/1/1/10/12': genesis1_10_to_12_ru,
};

const SHOT_OPTIONS = {
  fullPage: true,
  animations: 'disabled',
  caret: 'hide',
  // Tiny anti-aliasing differences are expected; catch layout shifts, not
  // sub-pixel font hinting.
  maxDiffPixelRatio: 0.01,
};

test.describe('@visual visual regression', () => {
  for (const theme of ['vellum', 'compline']) {
    for (const layout of ['1-panel', '3-panel']) {
      for (const mode of ['reading', 'presentation']) {
        test(`${theme} / ${layout} / ${mode}`, async ({ page }) => {
          const langs = layout === '1-panel' ? ['ka'] : ['ka', 'en', 'ru'];
          const routes = layout === '1-panel' ? ONE_PANEL_ROUTES : THREE_PANEL_ROUTES;
          const expectedVerses = langs.length * 3;

          await mockApi(page, routes);
          await page.setViewportSize({ width: 1280, height: 800 });
          await setupPage(page, { theme, mode, langs });

          await search(page, 'Gen 1:10-12');

          // Wait for verses to render in every enabled panel before snapping.
          await expect(page.locator('.translation-result .verse')).toHaveCount(expectedVerses);
          // Block until web fonts are resolved; otherwise the first paint may
          // land on the Georgia fallback and diff against a baseline that
          // captured Cormorant/EB Garamond.
          await page.evaluate(() => document.fonts.ready);

          await expect(page).toHaveScreenshot(
            `${theme}-${layout}-${mode}.png`,
            SHOT_OPTIONS,
          );
        });
      }
    }
  }
});
