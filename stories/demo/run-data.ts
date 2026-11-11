/**
 * Pipeline run #20261110.1 of "playwright-bdd-pane demo" (build 1325 in the Shko-Online
 * organization), which ran samples/demo/azure-pipelines.yml. Taken from the Azure DevOps
 * build, timeline and test results APIs. The two report zips next to the stories
 * (assets/runs/20261110.1) are the build attachments the task published in that run.
 */

export type Result = 'succeeded' | 'failed' | 'skipped';

export interface Step {
  name: string;
  result: Result;
  durationMs: number;
  /** Task reference shown under the step name, for the steps that use this extension. */
  task?: string;
}

export interface Issue {
  type: 'error' | 'warning';
  source: string;
  message: string;
}

export interface TestCase {
  suite: string;
  name: string;
  outcome: 'passed' | 'failed';
  durationMs: number;
  steps: string[];
  error?: string;
}

export interface PublishedReport {
  /** Same as the attachment name without ".zip", which is what the tab shows. */
  name: string;
  /** File under assets/runs/20261110.1/. */
  file: string;
  step: string;
}

const failure = `Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('listitem')
Expected: 3
Received: 1
Timeout:  1000ms

Call log:
  - Expect "toHaveCount" getByRole('listitem') with timeout 1000ms
  - waiting for getByRole('listitem')
    12 × locator resolved to 1 element
       - unexpected value "1"

   at ../steps/todo.steps.ts:36

  34 |
  35 | Then(/^I see (\\d+) todos?$/, async ({ page }, count: string) => {
> 36 |   await expect(page.getByRole('listitem')).toHaveCount(Number(count), { timeout: 1000 });
     |                                            ^
  37 | });
  38 |
  39 | Then('I see the todo {string}', async ({ page }, text: string) => {

    at Object.<anonymous> (/home/runner/work/1/s/samples/demo/steps/todo.steps.ts:36:44)
    at /home/runner/work/1/s/samples/demo/.features-gen/features/todo.feature.spec.js:24:5`;

export const run = {
  organization: 'Shko-Online',
  project: 'Shko.Online',
  pipeline: 'playwright-bdd-pane demo',
  buildId: 1325,
  buildNumber: '20261110.1',
  /** The commit message, which Azure DevOps uses as the run title. */
  title: 'Add Playwright BDD Report Azure DevOps extension',
  result: 'failed' as Result,
  reason: 'Manually triggered',
  repository: 'playwright-bdd-pane',
  branch: 'feature/playwright-bdd-extension',
  commit: '29b09bbd123066322fab57c274e8948c76a1fe12',
  started: '2026-11-10T19:10:11.610Z',
  durationMs: 65_433,
  pipelineFile: 'samples/demo/azure-pipelines.yml',

  issues: [
    { type: 'error', source: 'Run playwright-bdd tests', message: "Bash exited with code '1'." },
    {
      type: 'warning',
      source: 'Job',
      message:
        'Remote machine provider issue: "The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026."',
    },
    { type: 'warning', source: 'Initialize job', message: "Task 'Node.js tool installer' version 0 (NodeTool@0) is deprecated." },
  ] as Issue[],

  job: {
    name: 'Job',
    result: 'failed' as Result,
    durationMs: 49_757,
    steps: [
      { name: 'Initialize job', result: 'succeeded', durationMs: 2_033 },
      { name: 'Checkout playwright-bdd-pane@feature/playwright-bdd-extension to s', result: 'succeeded', durationMs: 1_813 },
      { name: 'NodeTool', result: 'succeeded', durationMs: 3_137 },
      { name: 'Install dependencies', result: 'succeeded', durationMs: 31_090 },
      { name: 'Run playwright-bdd tests', result: 'failed', durationMs: 5_150 },
      { name: 'Publish Cucumber report', result: 'succeeded', durationMs: 580, task: 'PublishPlaywrightBddReport@1' },
      { name: 'Publish Playwright report', result: 'succeeded', durationMs: 483, task: 'PublishPlaywrightBddReport@1' },
      { name: 'PublishTestResults', result: 'succeeded', durationMs: 4_947 },
      { name: 'Post-job: Checkout playwright-bdd-pane@feature/playwright-bdd-extension to s', result: 'succeeded', durationMs: 253 },
      { name: 'Finalize Job', result: 'succeeded', durationMs: 20 },
    ] as Step[],
  },

  reports: [
    { name: 'Cucumber report', file: 'cucumber-report.zip', step: 'Publish Cucumber report' },
    { name: 'Playwright report', file: 'playwright-report.zip', step: 'Publish Playwright report' },
  ] as PublishedReport[],

  tests: {
    durationMs: 3_031,
    cases: [
      {
        suite: 'Todo list',
        name: 'Deliberately failing scenario',
        outcome: 'failed',
        durationMs: 1_239,
        steps: ['Given I open the todo app', 'When I add the todo "This one fails"', 'Then I see 3 todos'],
        error: failure,
      },
      {
        suite: 'Todo list',
        name: 'Add a single todo',
        outcome: 'passed',
        durationMs: 302,
        steps: ['Given I open the todo app', 'When I add the todo "Buy milk"', 'Then I see 1 todo', 'And I see the todo "Buy milk"'],
      },
      {
        suite: 'Todo list',
        name: 'Add several todos',
        outcome: 'passed',
        durationMs: 274,
        steps: [
          'Given I open the todo app',
          'When I add the todo "Write tests"',
          'And I add the todo "Publish report"',
          'Then I see 2 todos',
        ],
      },
    ] as TestCase[],
  },
};

/** The two tasks of samples/demo/azure-pipelines.yml that published this run's reports. */
export const publishYaml = `- task: PublishPlaywrightBddReport@1
  displayName: Publish Cucumber report
  condition: succeededOrFailed()
  inputs:
    reportDir: cucumber-report
    reportName: Cucumber report

- task: PublishPlaywrightBddReport@1
  displayName: Publish Playwright report
  condition: succeededOrFailed()
  inputs:
    reportDir: playwright-report
    reportName: Playwright report`;
