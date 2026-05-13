// @ts-check
// Live-API smoke test. Tagged @smoke and skipped by default so the mocked
// suite remains hermetic. Run with: `npm run test:smoke`.
const { test, expect } = require('./fixtures/coverage');

test.describe('Bible ref reader (live API)', () => {
  test('fetches a real verse via /api/search/ @smoke', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('#search');
    await input.fill('Gen 1:1');
    await input.dispatchEvent('keyup');

    const panel = page.locator('.translation-result[data-lang="ka"]');
    await expect(panel.locator('.title')).toBeVisible({ timeout: 15_000 });
    await expect(panel.locator('.title')).not.toHaveText('Loading...', {
      timeout: 15_000,
    });
    await expect(panel.locator('.verse').first()).toBeVisible();
  });

  test('performs a real text search @smoke', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('#search');
    await input.fill('/beginning');
    await input.dispatchEvent('keyup');

    // ka/geo doesn't have 'beginning' but the request should still resolve.
    // Either we see matches or an empty-state error — both prove the path
    // reached the live endpoint without crashing.
    const panel = page.locator('.translation-result[data-lang="ka"]');
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.locator('.title, .match, .error, .count')).not.toHaveCount(0);
  });
});
