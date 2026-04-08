import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyTheme, readThemeFromCookie, type DisplayTheme } from '@/lib/themeCookie';
import { cn } from '@/lib/utils';

/**
 * Shared site footer — colors follow `index.css` `--site-footer-*` so the bar matches each theme
 * (original `bg-foreground` look in light; warm charcoal in warm-dark).
 */
export function SiteFooter() {
  const [theme, setTheme] = useState<DisplayTheme>('light');

  useEffect(() => {
    const saved = readThemeFromCookie();
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const toggle = () => {
    const next: DisplayTheme = theme === 'light' ? 'warm-dark' : 'light';
    setTheme(next);
    applyTheme(next);
  };

  return (
    <footer className="site-footer py-12 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Heart className="h-5 w-5" />
              <span className="font-display text-lg font-bold">House of Hope</span>
            </div>
            <p className="text-sm opacity-70 max-w-xs">
              Providing safe shelter and hope for girls who are survivors of abuse and trafficking in the Philippines.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-8 lg:gap-12 w-full lg:w-auto">
            <div className="flex flex-col gap-2">
              <Link to="/privacy" className="text-sm opacity-70 hover:opacity-100 transition-opacity">Privacy Policy</Link>
              <Link to="/impact" className="text-sm opacity-70 hover:opacity-100 transition-opacity">Donor Impact</Link>
              <Link to="/login" className="text-sm opacity-70 hover:opacity-100 transition-opacity">Staff Login</Link>
            </div>
            <div className="flex flex-col gap-2 sm:items-end sm:text-right">
              <p className="text-xs opacity-70 max-w-[16rem] sm:max-w-xs">
                Display preference (saved in your browser):
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'site-footer-theme-btn w-fit gap-2 border border-transparent shadow-none',
                  'hover:text-[hsl(var(--site-footer-fg))]'
                )}
                onClick={toggle}
                aria-pressed={theme === 'warm-dark'}
                aria-label={theme === 'light' ? 'Switch to warm dark mode' : 'Switch to light mode'}
              >
                {theme === 'light' ? (
                  <>
                    <Moon className="h-4 w-4" />
                    Warm dark
                  </>
                ) : (
                  <>
                    <Sun className="h-4 w-4" />
                    Light
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
        <div className="site-footer-rule mt-8 pt-6 text-center">
          <p className="text-xs opacity-50">
            © {new Date().getFullYear()} House of Hope. All rights reserved. We use cookies to improve your experience. See our{' '}
            <Link to="/privacy" className="underline hover:opacity-100">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </footer>
  );
}
