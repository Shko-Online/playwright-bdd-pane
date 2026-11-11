/**
 * A stand-in for the Azure DevOps pipeline run page of run #20261110.1. Only the
 * "Playwright BDD" tab is real: it is the extension's ReportViewer showing the reports that
 * run published. The rest is a lightweight recreation, so the tab can be tried without
 * installing the extension in an organization.
 */
import { icons } from './icons';
import { publishYaml, run, type Issue, type Result, type Step, type TestCase } from './run-data';
import { DemoRunSource, mountViewer } from './sources';

export type RunTab = 'summary' | 'tests' | 'playwright-bdd';

export interface RunPageOptions {
  tab: RunTab;
  /** Show the strip that explains this is a demo. */
  demoBanner: boolean;
}

const GITHUB = 'https://github.com/Shko-Online/playwright-bdd-pane';
const MARKETPLACE = 'https://marketplace.visualstudio.com/items?itemName=shko-online.playwright-bdd-pane';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function duration(ms: number): string {
  if (ms < 1000) return `<1s`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const statusIcon = (result: Result | 'passed', size = 16) =>
  result === 'failed' ? icons.failed(size) : icons.succeeded(size);

export function createRunPage(options: RunPageOptions): HTMLElement {
  const page = document.createElement('div');
  page.className = 'ado';
  const failed = run.tests.cases.filter((t) => t.outcome === 'failed').length;
  const passed = run.tests.cases.length - failed;
  const passRate = ((passed / run.tests.cases.length) * 100).toFixed(1);

  page.innerHTML = `
    ${options.demoBanner ? demoBanner() : ''}
    <header class="ado-topbar">
      <span class="ado-logo">${icons.logo()}</span>
      <nav class="ado-breadcrumb" aria-label="Breadcrumb">
        <span>${esc(run.organization)}</span><span class="ado-sep">/</span>
        <span>${esc(run.project)}</span><span class="ado-sep">/</span>
        <span>Pipelines</span><span class="ado-sep">/</span>
        <span>${esc(run.pipeline)}</span><span class="ado-sep">/</span>
        <span aria-current="page">${esc(run.buildNumber)}</span>
      </nav>
      <span class="ado-search">${icons.search()}<span>Search</span></span>
      <span class="ado-topbar-icon" title="Settings">${icons.settings()}</span>
    </header>
    <div class="ado-body">
      <nav class="ado-rail" aria-label="Project navigation">
        <span class="ado-project-avatar" title="${esc(run.project)}">SO</span>
        <span class="ado-rail-item" title="Overview">${icons.overview()}</span>
        <span class="ado-rail-item" title="Boards">${icons.boards()}</span>
        <span class="ado-rail-item" title="Repos">${icons.repos()}</span>
        <span class="ado-rail-item is-active" title="Pipelines">${icons.pipelines()}</span>
        <span class="ado-rail-item" title="Test Plans">${icons.testPlans()}</span>
        <span class="ado-rail-item" title="Artifacts">${icons.artifacts()}</span>
      </nav>
      <main class="ado-page">
        <div class="ado-run-header">
          <span class="ado-run-status">${statusIcon(run.result, 28)}</span>
          <div class="ado-run-title">
            <h1>#${esc(run.buildNumber)} • ${esc(run.title)}</h1>
            <div class="ado-muted">${icons.pipelines()} ${esc(run.pipeline)}</div>
          </div>
          <div class="ado-run-actions">
            <button type="button" class="ado-button" disabled title="Not available in this demo">Rerun failed jobs</button>
            <button type="button" class="ado-button ado-button-primary" disabled title="Not available in this demo">Run new</button>
          </div>
        </div>
        <div class="ado-tabs" role="tablist">
          ${tabButton('summary', 'Summary')}
          ${tabButton('tests', 'Tests')}
          ${tabButton('playwright-bdd', 'Playwright BDD')}
        </div>
        <section class="ado-panel ado-scroll" data-panel="summary" role="tabpanel" aria-label="Summary">
          ${summary(passRate)}
        </section>
        <section class="ado-panel ado-scroll" data-panel="tests" role="tabpanel" aria-label="Tests">
          ${tests(passed, failed, passRate)}
        </section>
        <section class="ado-panel ado-extension" data-panel="playwright-bdd" role="tabpanel" aria-label="Playwright BDD">
          <div class="ado-extension-root"></div>
        </section>
      </main>
    </div>`;

  const viewerRoot = page.querySelector<HTMLElement>('.ado-extension-root')!;
  let viewerMounted = false;

  const show = (tab: RunTab) => {
    page.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab));
    page.querySelectorAll<HTMLElement>('[role="tab"]').forEach((t) => {
      const active = t.dataset.tab === tab;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    // Like Azure DevOps, the extension's frame only loads when its tab is first opened.
    if (tab === 'playwright-bdd' && !viewerMounted) {
      viewerMounted = true;
      mountViewer(viewerRoot, new DemoRunSource());
    }
  };

  const openReport = (name: string) => {
    show('playwright-bdd');
    const picker = viewerRoot.querySelector<HTMLSelectElement>('.pbdd-picker');
    const option = picker && [...picker.options].find((o) => o.text === name);
    if (picker && option && picker.value !== option.value) {
      picker.value = option.value;
      picker.dispatchEvent(new Event('change'));
    }
  };

  page.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-tab], [data-open-report], [data-toggle]');
    if (!el) return;
    if (el.dataset.tab) show(el.dataset.tab as RunTab);
    else if (el.dataset.openReport) openReport(el.dataset.openReport);
    else if (el.dataset.toggle) {
      const target = page.querySelector<HTMLElement>(`#${el.dataset.toggle}`)!;
      target.hidden = !target.hidden;
      el.setAttribute('aria-expanded', String(!target.hidden));
    }
  });
  page.querySelector('.ado-tabs')!.addEventListener('keydown', (e) => {
    const key = (e as KeyboardEvent).key;
    if (key !== 'ArrowRight' && key !== 'ArrowLeft') return;
    const tabs = [...page.querySelectorAll<HTMLElement>('[role="tab"]')];
    const i = tabs.indexOf(document.activeElement as HTMLElement);
    const next = tabs[(i + (key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    show(next.dataset.tab as RunTab);
  });

  show(options.tab);
  return page;
}

function demoBanner(): string {
  return `<div class="ado-demo-banner">
    <strong>Interactive demo</strong>
    <span>A recreation of pipeline run #${esc(run.buildNumber)} of the
      <a href="${GITHUB}/tree/main/samples/demo" target="_blank" rel="noopener">sample project</a>.
      The <b>Playwright BDD</b> tab is the real extension, showing the reports that run published.</span>
    <span class="ado-demo-links">
      <a href="${MARKETPLACE}" target="_blank" rel="noopener">Get the extension ${icons.external()}</a>
      <a href="${GITHUB}" target="_blank" rel="noopener">Source on GitHub ${icons.external()}</a>
    </span>
  </div>`;
}

function tabButton(tab: RunTab, label: string): string {
  return `<button type="button" role="tab" class="ado-tab" data-tab="${tab}">${label}</button>`;
}

function summary(passRate: string): string {
  const started = new Date(run.started).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const errors = run.issues.filter((i) => i.type === 'error').length;
  const warnings = run.issues.length - errors;
  return `
    <div class="ado-card ado-facts">
      <div class="ado-fact">
        <div class="ado-fact-label">${icons.person()} ${esc(run.reason)}</div>
        <div class="ado-fact-value">${statusIcon(run.result)} Failed</div>
      </div>
      <div class="ado-fact">
        <div class="ado-fact-label">${icons.repo()} Repository and version</div>
        <div class="ado-fact-value">${esc(run.repository)}</div>
        <div class="ado-fact-sub">${icons.branch()} ${esc(run.branch)} &nbsp; ${icons.commit()} ${run.commit.slice(0, 7)}</div>
      </div>
      <div class="ado-fact">
        <div class="ado-fact-label">${icons.clock()} Time started and elapsed</div>
        <div class="ado-fact-value">${esc(started)}</div>
        <div class="ado-fact-sub">${duration(run.durationMs)}</div>
      </div>
      <div class="ado-fact">
        <div class="ado-fact-label">${icons.report()} Related</div>
        <div class="ado-fact-value"><button type="button" class="ado-link" data-tab="playwright-bdd">${run.reports.length} Playwright BDD reports</button></div>
      </div>
      <div class="ado-fact">
        <div class="ado-fact-label">${icons.test()} Tests</div>
        <div class="ado-fact-value"><button type="button" class="ado-link" data-tab="tests">${passRate}% passed</button></div>
      </div>
    </div>

    <div class="ado-card">
      <h2>Errors <span class="ado-count">${errors}</span> Warnings <span class="ado-count">${warnings}</span></h2>
      <ul class="ado-issues">${run.issues.map(issue).join('')}</ul>
    </div>

    <div class="ado-card">
      <h2>Jobs</h2>
      <button type="button" class="ado-job" data-toggle="ado-steps" aria-expanded="true" aria-controls="ado-steps">
        <span class="ado-chevron">${icons.chevron()}</span>
        ${statusIcon(run.job.result)}
        <span class="ado-job-name">${esc(run.job.name)}</span>
        <span class="ado-muted">${duration(run.job.durationMs)}</span>
      </button>
      <ol class="ado-steps" id="ado-steps">${run.job.steps.map(step).join('')}</ol>
    </div>

    <div class="ado-card">
      <h2>How this run published its reports</h2>
      <p class="ado-muted">From <a href="https://github.com/Shko-Online/playwright-bdd-pane/blob/main/${run.pipelineFile}" target="_blank" rel="noopener">${esc(run.pipelineFile)}</a>, after the test step:</p>
      <pre class="ado-code">${esc(publishYaml)}</pre>
    </div>`;
}

function issue(i: Issue): string {
  return `<li class="ado-issue">${i.type === 'error' ? icons.failed() : icons.warning()}
    <div><div>${esc(i.message)}</div><div class="ado-muted">${esc(i.source)}</div></div></li>`;
}

function step(s: Step): string {
  const report = run.reports.find((r) => r.step === s.name);
  return `<li class="ado-step${s.task ? ' is-highlighted' : ''}">
    ${statusIcon(s.result)}
    <span class="ado-step-name">${esc(s.name)}${s.task ? `<span class="ado-task-ref">${esc(s.task)}</span>` : ''}</span>
    ${report ? `<button type="button" class="ado-link" data-open-report="${esc(report.name)}">View report</button>` : ''}
    <span class="ado-muted ado-step-duration">${duration(s.durationMs)}</span>
  </li>`;
}

function tests(passed: number, failed: number, passRate: string): string {
  return `
    <div class="ado-card ado-test-summary">
      <div><div class="ado-big">${run.tests.cases.length}</div><div class="ado-muted">Total tests</div></div>
      <div><div class="ado-big ado-passed">${passed}</div><div class="ado-muted">Passed</div></div>
      <div><div class="ado-big ado-failed">${failed}</div><div class="ado-muted">Failed</div></div>
      <div><div class="ado-big">${passRate}%</div><div class="ado-muted">Pass percentage</div></div>
      <div><div class="ado-big">${duration(run.tests.durationMs)}</div><div class="ado-muted">Run duration</div></div>
    </div>
    <div class="ado-card">
      <p class="ado-muted ado-tests-hint">Published with PublishTestResults@2 from the Cucumber report's junit.xml. For steps, screenshots and traces, open the
        <button type="button" class="ado-link" data-tab="playwright-bdd">Playwright BDD</button> tab.</p>
      <ul class="ado-tests">${run.tests.cases.map(testRow).join('')}</ul>
    </div>`;
}

function testRow(t: TestCase, index: number): string {
  const id = `ado-test-${index}`;
  return `<li class="ado-test">
    <button type="button" class="ado-test-row" data-toggle="${id}" aria-expanded="${t.error ? 'true' : 'false'}" aria-controls="${id}">
      <span class="ado-chevron">${icons.chevron()}</span>
      ${statusIcon(t.outcome)}
      <span class="ado-test-name">${esc(t.name)}<span class="ado-muted"> · ${esc(t.suite)}</span></span>
      <span class="ado-muted">${duration(t.durationMs)}</span>
    </button>
    <div class="ado-test-details" id="${id}"${t.error ? '' : ' hidden'}>
      <ol class="ado-test-steps">${t.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      ${t.error ? `<pre class="ado-code ado-error">${esc(t.error)}</pre>` : ''}
    </div>
  </li>`;
}
