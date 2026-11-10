/*
    "Built for free by Shko Online" link and the details dialog it opens.
    Deliberately low-key: a muted link in the toolbar; the dialog only opens on click.
*/

const SITE = 'https://shko.online';
const CAMPAIGN = 'utm_source=azure-devops&utm_medium=extension&utm_campaign=playwright-bdd-report';
const EMAIL = 'sales@shko.online';

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
    </p></div>`;
  // Click on the backdrop closes the dialog.
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  document.body.appendChild(d);
  return d;
}
