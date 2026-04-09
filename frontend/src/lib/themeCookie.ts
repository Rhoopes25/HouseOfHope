import { isPreferenceCookieConsentAccepted, THEME_COOKIE_NAME } from '@/lib/preferenceCookies';

export type DisplayTheme = 'light' | 'warm-dark';

const COOKIE_MAX_AGE = 31536000;

export function readThemeFromCookie(): DisplayTheme {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${THEME_COOKIE_NAME}=(light|warm-dark|default|ocean)(?:;|$)`)
  );
  const raw = match?.[1];
  if (raw === 'warm-dark') return 'warm-dark';
  if (raw === 'light') return 'light';
  if (raw === 'default' || raw === 'ocean') return 'light';
  return 'light';
}

export function setThemeOnDocument(theme: DisplayTheme) {
  document.documentElement.setAttribute('data-user-theme', theme);
}

export function getDocumentTheme(): DisplayTheme {
  const attr = document.documentElement.getAttribute('data-user-theme');
  return attr === 'warm-dark' ? 'warm-dark' : 'light';
}

export function persistThemeToCookie(theme: DisplayTheme) {
  if (!isPreferenceCookieConsentAccepted()) return;
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Apply theme to the page and persist to cookie only when consent allows. */
export function applyTheme(theme: DisplayTheme) {
  setThemeOnDocument(theme);
  persistThemeToCookie(theme);
}

/** After user accepts cookies — persist whatever theme is currently on the document root. */
export function syncDocumentThemeToCookie() {
  persistThemeToCookie(getDocumentTheme());
}
