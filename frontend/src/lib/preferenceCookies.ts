/** localStorage key — keep in sync with CookieConsentContext */
export const HOH_COOKIE_CONSENT_KEY = 'hoh_cookie_consent';

export const THEME_COOKIE_NAME = 'display_theme';
export const SIDEBAR_STATE_COOKIE_NAME = 'sidebar:state';

export function isPreferenceCookieConsentAccepted(): boolean {
  try {
    return localStorage.getItem(HOH_COOKIE_CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

/** Remove non-essential preference cookies (theme + sidebar). */
export function clearPreferenceBrowserCookies(): void {
  if (typeof document === 'undefined') return;
  const past = 'Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `${THEME_COOKIE_NAME}=; expires=${past}; path=/; SameSite=Lax`;
  document.cookie = `${SIDEBAR_STATE_COOKIE_NAME}=; expires=${past}; path=/`;
}
