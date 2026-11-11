/** Small inline icons for the demo run page. Simple shapes drawn for this demo. */

const svg = (body: string, size = 16, viewBox = '0 0 16 16') =>
  `<svg class="ado-icon" width="${size}" height="${size}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;

const stroke = 'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"';

export const icons = {
  failed: (size = 16) =>
    svg(
      `<circle cx="8" cy="8" r="8" fill="var(--ado-status-failed)"/><path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
      size,
    ),
  succeeded: (size = 16) =>
    svg(
      `<circle cx="8" cy="8" r="8" fill="var(--ado-status-succeeded)"/><path d="M4.6 8.3l2.3 2.3 4.5-4.8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
      size,
    ),
  warning: (size = 16) =>
    svg(
      `<path d="M8 1.5l7 12.5H1z" fill="var(--ado-status-warning)"/><path d="M8 6v4" stroke="#000" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="12" r=".8" fill="#000"/>`,
      size,
    ),
  logo: () =>
    svg(
      `<rect x="1" y="1" width="9" height="9" rx="2" fill="var(--ado-accent)"/><rect x="6" y="6" width="9" height="9" rx="2" fill="none" stroke="var(--ado-accent)" stroke-width="1.6"/>`,
      20,
    ),
  search: () => svg(`<circle cx="7" cy="7" r="4.5" ${stroke}/><path d="M10.5 10.5L14 14" ${stroke}/>`),
  sun: () =>
    svg(
      `<circle cx="8" cy="8" r="2.8" ${stroke}/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" ${stroke}/>`,
    ),
  moon: () => svg(`<path d="M13.5 9.6A5.8 5.8 0 016.4 2.5a5.8 5.8 0 107.1 7.1z" ${stroke}/>`),
  plus: () => svg(`<path d="M8 2.5v11M2.5 8h11" ${stroke}/>`),
  overview: () => svg(`<rect x="2" y="2" width="5" height="5" rx="1" ${stroke}/><rect x="9" y="2" width="5" height="5" rx="1" ${stroke}/><rect x="2" y="9" width="5" height="5" rx="1" ${stroke}/><rect x="9" y="9" width="5" height="5" rx="1" ${stroke}/>`),
  boards: () => svg(`<rect x="2" y="2" width="3.5" height="12" rx="1" ${stroke}/><rect x="6.5" y="2" width="3.5" height="8" rx="1" ${stroke}/><rect x="11" y="2" width="3" height="10" rx="1" ${stroke}/>`),
  repos: () => svg(`<circle cx="4.5" cy="3.5" r="1.6" ${stroke}/><circle cx="4.5" cy="12.5" r="1.6" ${stroke}/><circle cx="11.5" cy="6" r="1.6" ${stroke}/><path d="M4.5 5.1v5.8M11.5 7.6c0 2.4-7 1.6-7 3.3" ${stroke}/>`),
  pipelines: () => svg(`<circle cx="8" cy="8" r="6" ${stroke}/><path d="M6.5 5.5l4 2.5-4 2.5z" ${stroke}/>`),
  testPlans: () => svg(`<path d="M6 2h4M6.8 2v4.2L3 13a1 1 0 00.9 1.5h8.2A1 1 0 0013 13L9.2 6.2V2" ${stroke}/><path d="M4.8 10h6.4" ${stroke}/>`),
  artifacts: () => svg(`<path d="M8 1.8l5.5 3v6.4L8 14.2l-5.5-3V4.8z" ${stroke}/><path d="M2.5 4.8L8 7.8l5.5-3M8 7.8v6.4" ${stroke}/>`),
  branch: () => svg(`<circle cx="4.5" cy="3.5" r="1.6" ${stroke}/><circle cx="4.5" cy="12.5" r="1.6" ${stroke}/><circle cx="11.5" cy="4.5" r="1.6" ${stroke}/><path d="M4.5 5.1v5.8M11.5 6.1c0 3-7 2.2-7 4.8" ${stroke}/>`),
  commit: () => svg(`<circle cx="8" cy="8" r="2.5" ${stroke}/><path d="M1.5 8h4M10.5 8h4" ${stroke}/>`),
  repo: () => svg(`<path d="M3.5 2h8.5v10H5a1.5 1.5 0 000 3h7" ${stroke}/><path d="M3.5 2v11.5" ${stroke}/>`),
  clock: () => svg(`<circle cx="8" cy="8" r="6" ${stroke}/><path d="M8 4.5V8l2.5 1.5" ${stroke}/>`),
  person: () => svg(`<circle cx="8" cy="5.5" r="2.8" ${stroke}/><path d="M2.8 14c.6-2.8 2.7-4.3 5.2-4.3s4.6 1.5 5.2 4.3" ${stroke}/>`),
  report: () => svg(`<path d="M4 1.8h5.5L12.5 5v9.2H4z" ${stroke}/><path d="M9.5 1.8V5h3M6 8.5h4.5M6 11h4.5" ${stroke}/>`),
  chevron: () => svg(`<path d="M6 4l4 4-4 4" ${stroke}/>`),
  external: () => svg(`<path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v4h-9v-9h4" ${stroke}/>`),
  test: () => svg(`<path d="M2.5 8.5l3 3 8-8" ${stroke}/>`),
};
