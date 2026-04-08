import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CatalogPage from './pages/CatalogPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import LogoutPage from './pages/LogoutPage';
import RegisterPage from './pages/RegisterPage';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import AdminRootbeerPage from './pages/AdminRootbeerPage';
import ManageMFAPage from './pages/ManageMFAPage';
import CookieConsentBanner from './components/CookieConsentBanner';
import CookiePolicyPage from './pages/CookiePolicyPage';
import { CookieConsentProvider } from './context/CookieConsentContext';

function App() {
  return (
    <CookieConsentProvider>
      <AuthProvider>
        <CartProvider>
          <Router>
            <Routes>
              <Route path="/" element={<CatalogPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/logout" element={<LogoutPage />} />
              <Route path="/admin/rootbeers" element={<AdminRootbeerPage />} />
              <Route
                path="/product/:rootbeerName/:rootbeerId/:currentRetailPrice"
                element={<ProductPage />}
              />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/mfa" element={<ManageMFAPage />} />
              <Route path="/cookies" element={<CookiePolicyPage />} />
            </Routes>
            <CookieConsentBanner />
          </Router>
        </CartProvider>
      </AuthProvider>
    </CookieConsentProvider>
  );
}

export default App;
