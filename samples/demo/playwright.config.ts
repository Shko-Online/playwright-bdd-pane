import { defineConfig } from '@playwright/test';
import { defineBddConfig, cucumberReporter } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: 'steps/*.ts',
});

export default defineConfig({
  testDir,
  reporter: [
    // Cucumber HTML report — this is what the Azure DevOps tab renders.
    cucumberReporter('html', { outputFile: 'cucumber-report/index.html', externalAttachments: true }),
    // JUnit for the built-in "Tests" tab (PublishTestResults@2).
    cucumberReporter('junit', { outputFile: 'cucumber-report/junit.xml', suiteName: 'playwright-bdd demo' }),
    // Playwright's own HTML report can also be published with the task.
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
});
