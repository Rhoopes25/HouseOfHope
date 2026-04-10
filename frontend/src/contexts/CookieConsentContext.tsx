import React, { createContext, useContext, useState, ReactNode } from 'react';
import { clearPreferenceBrowserCookies, HOH_COOKIE_CONSENT_KEY } from '@/lib/preferenceCookies';
import { syncDocumentThemeToCookie } from '@/lib/themeCookie';

type ConsentStatus = 'pending' | 'accepted' | 'declined';

function readStoredConsent(): ConsentStatus {
  try {
    const stored = localStorage.getItem(HOH_COOKIE_CONSENT_KEY);
    if (stored === 'accepted' || stored === 'declined') return stored;
  } catch {
    /* ignore */
  }
  return 'pending';
}

interface CookieConsentContextType {
  consent: ConsentStatus;
  acceptCookies: () => void;
  declineCookies: () => void;
  openCookiePreferences: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentStatus>(readStoredConsent);

  const acceptCookies = () => {
    setConsent('accepted');
    localStorage.setItem(HOH_COOKIE_CONSENT_KEY, 'accepted');
    syncDocumentThemeToCookie();
  };

  const declineCookies = () => {
    setConsent('declined');
    localStorage.setItem(HOH_COOKIE_CONSENT_KEY, 'declined');
    clearPreferenceBrowserCookies();
  };

  const openCookiePreferences = () => {
    try {
      localStorage.removeItem(HOH_COOKIE_CONSENT_KEY);
    } catch {
      /* ignore */
    }
    setConsent('pending');
  };

  return (
    <CookieConsentContext.Provider
      value={{ consent, acceptCookies, declineCookies, openCookiePreferences }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used within CookieConsentProvider');
  return ctx;
}
