export type DisplayTheme = 'light' | 'warm-dark';

const COOKIE_NAME = 'display_theme';
const COOKIE_MAX_AGE = 31536000;

export function readThemeFromCookie(): DisplayTheme {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=(light|warm-dark|default|ocean)(?:;|$)`)
  );
  const raw = match?.[1];
  if (raw === 'warm-dark') return 'warm-dark';
  if (raw === 'light') return 'light';
  if (raw === 'default' || raw === 'ocean') return 'light';
  return 'light';
}

export function applyTheme(theme: DisplayTheme) {
  document.documentElement.setAttribute('data-user-theme', theme);
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}
