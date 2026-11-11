/** Light or dark, as set on `<html data-ado-theme>` (see tab.css: the report frame follows it). */
export type Scheme = 'light' | 'dark';

/** Relative luminance (0–1) of a computed `rgb()`/`rgba()` colour. */
export function luminance(color: string): number {
  const [r, g, b] = (color.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Marks the page light or dark (`<html data-ado-theme>`). Reports shown in the page's frame
 * then get that as their preferred colour scheme, so the ones that follow it (the Cucumber
 * report, Playwright's "System" setting) switch with the page.
 */
export function setScheme(scheme: Scheme | undefined): void {
  if (scheme) document.documentElement.dataset.adoTheme = scheme;
  else delete document.documentElement.dataset.adoTheme;
}
