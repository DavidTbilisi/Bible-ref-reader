// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: [
    ['list'],
    [
      'monocart-reporter',
      {
        name: 'Bible ref reader',
        outputFile: './coverage/index.html',
        coverage: {
          entryFilter: (entry) => {
            const url = entry.url || '';
            return (
              url.endsWith('/Bible.js') ||
              url.endsWith('/Parser.js') ||
              url.endsWith('/main.js')
            );
          },
          sourceFilter: (sourcePath) => /\/(Bible|Parser|main)\.js$/.test(sourcePath),
          reports: [
            ['v8'],
            ['v8-json', { outputFile: 'coverage-summary.json' }],
            ['console-summary'],
          ],
          outputDir: path.resolve(__dirname, 'coverage'),
        },
      },
    ],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx http-server -p ${PORT} -c-1 --silent .`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
