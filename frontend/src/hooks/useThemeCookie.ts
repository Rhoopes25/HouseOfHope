import { useEffect } from 'react';
import { applyTheme, readThemeFromCookie } from '@/lib/themeCookie';

/** Applies saved theme from cookie on load (e.g. direct navigation to admin without public footer). */
export function useThemeCookieBootstrap() {
  useEffect(() => {
    applyTheme(readThemeFromCookie());
  }, []);
}
