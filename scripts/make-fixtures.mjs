// Runs the built task (exactly as the agent would) against the sample reports in
// samples/demo, writing the resulting archives to .fixtures/ for the dev harness.
// Prerequisites: `npm run build` and `cd samples/demo && npm install && npx playwright install chromium && npm test`.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, '.fixtures');
const demo = path.join(root, 'samples', 'demo');
const task = path.join(root, 'build', 'tasks', 'PublishPlaywrightBddReport', 'index.js');

fs.rmSync(fixtures, { recursive: true, force: true });
fs.mkdirSync(fixtures, { recursive: true });

for (const [dir, name] of [
  ['cucumber-report', 'Cucumber report'],
  ['playwright-report', 'Playwright HTML report'],
]) {
  if (!fs.existsSync(path.join(demo, dir))) {
    console.warn(`skip ${dir}: run the sample tests first (cd samples/demo && npm test)`);
    continue;
  }
  const out = execFileSync(process.execPath, [task], {
    env: {
      ...process.env,
      INPUT_REPORTDIR: dir,
      INPUT_REPORTNAME: name,
      INPUT_IFMISSING: 'error',
      SYSTEM_DEFAULTWORKINGDIRECTORY: demo,
      AGENT_TEMPDIRECTORY: fixtures,
      SYSTEM_JOBDISPLAYNAME: 'Local',
    },
  }).toString();
  const done = out.split('\n').find((l) => l.startsWith('##vso[task.complete'));
  console.log(done ?? out);
}
