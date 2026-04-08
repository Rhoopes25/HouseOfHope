import Header from '../components/Header';

function CookiePolicyPage() {
  return (
    <div className="container mt-4">
      <Header />
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card shadow-sm text-start">
            <div className="card-body p-4 p-lg-5">
              <h2 className="h3 mb-3">Cookie Policy</h2>
              <p className="text-muted">
                This teaching app uses a small set of essential cookies to keep
                authentication and external-login flows working.
              </p>

              <h3 className="h5 mt-4">Essential cookies used by this app</h3>
              <ul>
                <li>
                  The ASP.NET Core Identity application cookie keeps the user
                  signed in after a successful local or external login.
                </li>
                <li>
                  ASP.NET Core may issue temporary security cookies during
                  external login challenges such as the Google Third-Party
                  Authentication.
                </li>
                <li>
                  This banner stores a local acknowledgement flag in the browser
                  so the notice does not reappear on every page load.
                </li>
              </ul>

              <h3 className="h5 mt-4">What we don't do</h3>
              <ul>
                <li>No analytics cookies</li>
                <li>No advertising cookies</li>
                <li>No cross-site tracking scripts</li>
              </ul>

              <h3 className="h5 mt-4">Note</h3>
              <p className="mb-0">
                In a real production app, legal requirements depend on your
                jurisdiction, audience, and the categories of data you collect.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CookiePolicyPage;
