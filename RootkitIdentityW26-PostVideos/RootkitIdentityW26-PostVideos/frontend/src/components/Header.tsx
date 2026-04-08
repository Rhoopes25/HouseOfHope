import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Header() {
  const { authSession, isAuthenticated, isLoading } = useAuth();
  const { isAdmin } = authSession.roles.includes('Admin')
    ? { isAdmin: true }
    : { isAdmin: false };

  let statusClassName = 'badge rounded-pill text-bg-secondary';
  let statusText = 'Checking session...';

  if (!isLoading && isAuthenticated) {
    statusClassName = 'badge rounded-pill text-bg-success';
    statusText = `Signed in as ${authSession.email ?? authSession.userName ?? 'user'}`;
  }

  if (!isLoading && !isAuthenticated) {
    statusClassName = 'badge rounded-pill text-bg-warning';
    statusText = 'Signed out';
  }

  return (
    <header className="row bg-secondary text-white mb-4 p-3 rounded align-items-center">
      <div className="col-lg-4">
        <h1 className="h3 mb-0">Rootkit Rootbeer Catalog</h1>
      </div>
      <div className="col-lg-4 mt-3 mt-lg-0 text-lg-center">
        <span className={statusClassName}>{statusText}</span>
      </div>
      <div className="col-lg-4 mt-3 mt-lg-0">
        <nav className="d-flex gap-3 justify-content-lg-end flex-wrap">
          <NavLink className="text-white text-decoration-none" to="/catalog">
            Catalog
          </NavLink>
          <NavLink className="text-white text-decoration-none" to="/cart">
            Cart
          </NavLink>
          <NavLink className="text-white text-decoration-none" to="/cookies">
            Cookies
          </NavLink>
          {isAuthenticated ? (
            <NavLink className="text-white text-decoration-none" to="/mfa">
              MFA
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink
              className="text-white text-decoration-none"
              to="/admin/rootbeers"
            >
              Admin
            </NavLink>
          ) : null}
          {!isAuthenticated ? (
            <>
              <NavLink className="text-white text-decoration-none" to="/login">
                Login
              </NavLink>
              <NavLink
                className="text-white text-decoration-none"
                to="/register"
              >
                Register
              </NavLink>
            </>
          ) : (
            <NavLink className="text-white text-decoration-none" to="/logout">
              Logout
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
