import { FormEvent, useEffect, useState } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import {
  createRootbeer,
  getManagedRootbeers,
  type RootbeerInput,
} from '../lib/rootbeerApi';
import type { Rootbeer } from '../types/Rootbeer';

const emptyRootbeer: RootbeerInput = {
  rootbeerName: '',
  firstBrewedYear: '',
  breweryName: '',
  city: '',
  state: '',
  country: '',
  description: '',
  wholesaleCost: 0,
  currentRetailPrice: 0,
  container: '',
};

function AdminRootbeerPage() {
  const { authSession, isLoading } = useAuth();
  const isAdmin = authSession.roles.includes('Admin');
  const [rootbeers, setRootbeers] = useState<Rootbeer[]>([]);
  const [formState, setFormState] = useState<RootbeerInput>(emptyRootbeer);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAdmin) {
      void loadRootbeers();
    }
  }, [isAdmin, isLoading]);

  async function loadRootbeers() {
    try {
      const data = await getManagedRootbeers();
      setRootbeers(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load admin data.'
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const createdRootbeer = await createRootbeer(formState);
      setRootbeers((current) => [...current, createdRootbeer]);
      setFormState(emptyRootbeer);
      setSuccessMessage(`Created ${createdRootbeer.rootbeerName}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to create rootbeer.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof RootbeerInput>(
    key: K,
    value: RootbeerInput[K]
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className="container mt-4">
      <Header />
      <div className="row">
        <div className="col-lg-5">
          <div className="card shadow-sm mb-4">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Admin Catalog Tools</h2>
              <p className="text-muted mb-3">
                This page demonstrates role-based UI and policy-protected API
                endpoints.
              </p>

              {isLoading ? <p>Checking your role...</p> : null}

              {!isLoading && !isAdmin ? (
                <div className="alert alert-danger" role="alert">
                  You must be in the Admin role to manage the catalog.
                </div>
              ) : null}

              {!isLoading && isAdmin ? (
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Rootbeer name</label>
                    <input
                      className="form-control"
                      value={formState.rootbeerName}
                      onChange={(event) =>
                        updateField('rootbeerName', event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Brewery name</label>
                    <input
                      className="form-control"
                      value={formState.breweryName}
                      onChange={(event) =>
                        updateField('breweryName', event.target.value)
                      }
                    />
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Retail price</label>
                      <input
                        className="form-control"
                        type="number"
                        step="0.01"
                        value={formState.currentRetailPrice}
                        onChange={(event) =>
                          updateField(
                            'currentRetailPrice',
                            Number(event.target.value)
                          )
                        }
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Wholesale cost</label>
                      <input
                        className="form-control"
                        type="number"
                        step="0.01"
                        value={formState.wholesaleCost}
                        onChange={(event) =>
                          updateField(
                            'wholesaleCost',
                            Number(event.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Container</label>
                    <input
                      className="form-control"
                      value={formState.container}
                      onChange={(event) =>
                        updateField('container', event.target.value)
                      }
                    />
                  </div>
                  {errorMessage ? (
                    <div className="alert alert-danger" role="alert">
                      {errorMessage}
                    </div>
                  ) : null}
                  {successMessage ? (
                    <div className="alert alert-success" role="alert">
                      {successMessage}
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Add rootbeer'}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Managed Catalog View</h2>
              <p className="text-muted mb-3">
                Admin users can see the current catalog entries and create new
                ones.
              </p>
              <ul className="list-group">
                {rootbeers.map((rootbeer) => (
                  <li
                    key={rootbeer.rootbeerID}
                    className="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <span>
                      <strong>{rootbeer.rootbeerName}</strong>
                      {rootbeer.breweryName
                        ? ` by ${rootbeer.breweryName}`
                        : ''}
                    </span>
                    <span>
                      {rootbeer.container || 'Unknown container'} | ${' '}
                      {rootbeer.currentRetailPrice.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminRootbeerPage;
