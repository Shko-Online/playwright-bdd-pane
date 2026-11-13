/*
    "Built for free by Shko Online" link and the details dialog it opens.
    Deliberately low-key: a muted link in the toolbar; the dialog only opens on click.
*/

const SITE = 'https://shko.online';
const CAMPAIGN = 'utm_source=azure-devops&utm_medium=extension&utm_campaign=playwright-bdd-report';
const EMAIL = 'sales@shko.online';

/** Version of the bundled Playwright Trace Viewer, set at build time (scripts/build.mjs). */
declare const __TRACE_VIEWER_VERSION__: string;
const TRACE_VIEWER_SOURCE = `https://github.com/microsoft/playwright/tree/v${__TRACE_VIEWER_VERSION__}/packages/trace-viewer`;
const APACHE_LICENSE = 'https://www.apache.org/licenses/LICENSE-2.0';

let dialog: HTMLDialogElement | undefined;

/** Creates the toolbar link. The dialog is built on first click. */
export function createUpsellLink(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pbdd-upsell-link';
  button.textContent = 'Built for free by Shko Online';
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', () => {
    const d = (dialog ??= buildDialog());
    d.showModal();
  });
  return button;
}

function buildDialog(): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'pbdd-upsell';
  d.setAttribute('aria-labelledby', 'pbdd-upsell-title');
  // Content lives in an inner box so a click on the <dialog> element itself means "backdrop".
  d.innerHTML = `<div class="pbdd-upsell-body">
    <form method="dialog" class="pbdd-upsell-close-form">
      <button class="pbdd-upsell-close" aria-label="Close">×</button>
    </form>
    <h2 id="pbdd-upsell-title">Built for free by Shko Online</h2>
    <p>
      Playwright BDD Report is a free extension from <strong>Shko Online</strong>, a Microsoft
      Business Applications consultancy in Tirana, Albania, and a Microsoft Partner Network member.
    </p>
    <p>We can help your team with:</p>
    <ul>
      <li><strong>Azure DevOps extensions, pipelines and test automation</strong>, like this one.</li>
      <li><strong>Dynamics 365, Power Platform and Azure projects</strong>, delivered end to end or with our consultants joining your team.</li>
      <li><strong>Bespoke Power Platform tools and PCF components</strong> for Dataverse teams.</li>
    </ul>
    <p>
      Need a feature in this extension, or help with your next project? Tell us about your goals
      and we will shape the right solution with you.
    </p>
    <div class="pbdd-upsell-actions">
      <a class="pbdd-button pbdd-button-primary" href="${SITE}/contact-us?${CAMPAIGN}" target="_blank" rel="noopener">Book a consultation</a>
      <a class="pbdd-button" href="${SITE}/consulting?${CAMPAIGN}" target="_blank" rel="noopener">How we work</a>
    </div>
    <p class="pbdd-upsell-fine">
      Or write to <a href="mailto:${EMAIL}?subject=${encodeURIComponent('Playwright BDD Report')}">${EMAIL}</a>.
      The extension stays free either way.
    </p>
    <section class="pbdd-upsell-legal" aria-labelledby="pbdd-upsell-legal-title">
      <h3 id="pbdd-upsell-legal-title">Playwright Trace Viewer</h3>
      <p>
        Traces open in the Playwright Trace Viewer, Copyright (c) Microsoft Corporation, embedded
        unmodified in this extension from the <code>playwright-core</code> npm package
        (version ${__TRACE_VIEWER_VERSION__}). It is licensed under the Apache License, Version 2.0.
      </p>
      <p>
        <a href="${TRACE_VIEWER_SOURCE}" target="_blank" rel="noopener">Source code on GitHub</a> ·
        <a href="${APACHE_LICENSE}" target="_blank" rel="noopener">Apache License 2.0</a>
      </p>
      <details class="pbdd-upsell-license">
        <summary>Notice and license</summary>
        <pre tabindex="0">Loading…</pre>
      </details>
    </section></div>`;
  // The notice and license that ship with the viewer (build/web/trace/), loaded when expanded.
  const license = d.querySelector<HTMLDetailsElement>('.pbdd-upsell-license')!;
  license.addEventListener('toggle', () => {
    if (license.open && !license.dataset.loaded) {
      license.dataset.loaded = 'true';
      void showLicense(license.querySelector('pre')!);
    }
  });
  // Click on the backdrop closes the dialog.
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  document.body.appendChild(d);
  return d;
}

async function showLicense(pre: HTMLElement): Promise<void> {
  const read = async (file: string) => {
    const response = await fetch(new URL(`trace/${file}`, location.href).href);
    if (!response.ok) throw new Error(`${response.status}`);
    return (await response.text()).trim();
  };
  try {
    const [notice, license] = await Promise.all([read('NOTICE'), read('LICENSE')]);
    pre.textContent = `${notice}\n\n${'-'.repeat(60)}\n\n${license}`;
  } catch {
    pre.textContent = `The license text could not be loaded. Read it at ${APACHE_LICENSE}.`;
  }
}
