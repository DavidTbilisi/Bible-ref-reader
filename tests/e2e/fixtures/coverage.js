// @ts-check
// Per-test V8 coverage fixture. Hands raw JS coverage to monocart-reporter
// via its addCoverageReport helper, which aggregates across tests.
const base = require('@playwright/test');
const { addCoverageReport } = require('monocart-reporter');

exports.test = base.test.extend({
  autoTestFixture: [
    async ({ page }, use, testInfo) => {
      const supported =
        testInfo.project.name === 'chromium' && typeof page.coverage !== 'undefined';

      if (supported) {
        await page.coverage.startJSCoverage({ resetOnNavigation: false });
      }

      await use('autoTestFixture');

      if (supported) {
        const coverage = await page.coverage.stopJSCoverage();
        await addCoverageReport(coverage, testInfo);
      }
    },
    { scope: 'test', auto: true },
  ],
});

exports.expect = base.expect;
