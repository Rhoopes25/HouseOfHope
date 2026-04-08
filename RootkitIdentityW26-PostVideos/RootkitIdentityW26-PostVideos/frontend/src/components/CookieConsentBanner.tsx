import { Link } from 'react-router-dom';
import { useCookieConsent } from '../context/CookieConsentContext';

function CookieConsentBanner() {
  const { hasAcknowledgedConsent, acknowledgeConsent } = useCookieConsent();

  if (hasAcknowledgedConsent) {
    return null;
  }

  return (
    <aside
      className="cookie-consent-banner shadow-lg"
      role="dialog"
      aria-live="polite"
    >
      <div className="cookie-consent-copy">
        <p className="cookie-consent-eyebrow mb-2">Cookie notice</p>
        <p className="mb-2">
          This demo uses essential cookies for sign-in and security features.
          Google sign-in may also set provider cookies during the external login
          flow.
        </p>
        <p className="mb-0">
          We are not adding analytics or marketing cookies in this phase. Read
          the <Link to="/cookies">cookie policy</Link> for the teaching version
          of the disclosure.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-warning fw-semibold"
        onClick={acknowledgeConsent}
      >
        Acknowledge essential cookies
      </button>
    </aside>
  );
}

export default CookieConsentBanner;
