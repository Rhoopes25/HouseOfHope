import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { logoutUser } from '../lib/authAPI';
import { useAuth } from '../context/AuthContext';

function LogoutPage() {
  const [message, setMessage] = useState('Signing you out...');
  const [errorMessage, setErrorMessage] = useState('');
  const { refreshAuthState } = useAuth();

  useEffect(() => {
    let isMounted = true;

    async function runLogout() {
      try {
        await logoutUser();
        await refreshAuthState();
        if (isMounted) {
          setMessage('You are now signed out.');
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to log out.'
          );
          setMessage('Logout did not complete.');
        }
      }
    }

    void runLogout();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="container mt-4">
      <Header />
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Logout</h2>
              <p>{message}</p>
              {errorMessage ? (
                <div className="alert alert-danger" role="alert">
                  {errorMessage}
                </div>
              ) : null}
              <div className="d-flex gap-3">
                <Link className="btn btn-primary" to="/catalog">
                  Return to catalog
                </Link>
                <Link className="btn btn-outline-secondary" to="/login">
                  Go to login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogoutPage;
