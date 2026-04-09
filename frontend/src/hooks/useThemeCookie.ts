import { useEffect } from 'react';
import { readThemeFromCookie, setThemeOnDocument } from '@/lib/themeCookie';

/** Applies saved theme from cookie on load (e.g. direct navigation to admin without public footer). Does not write cookies. */
export function useThemeCookieBootstrap() {
  useEffect(() => {
    setThemeOnDocument(readThemeFromCookie());
  }, []);
}
