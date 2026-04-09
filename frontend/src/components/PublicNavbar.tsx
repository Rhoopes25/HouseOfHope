import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Heart, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function PublicNavbar() {
  const { isAuthenticated, user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="bg-card/95 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/favicon.png" alt="House of Hope logo" className="h-14 w-14 rounded-full" />
          <span className="font-display text-xl font-bold text-foreground">House of Hope</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Home</Link>
          <Link to="/impact" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Impact</Link>
          <Link to="/privacy" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Privacy</Link>
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Hi, {user?.displayName}</span>
              {hasRole('admin') && (
                <Button size="sm" variant="outline" onClick={() => navigate('/admin')}>Admin Dashboard</Button>
              )}
              {hasRole('donor') && (
                <Button size="sm" variant="outline" onClick={() => navigate('/donor-portal')}>Donor Portal</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => navigate('/profile')}>Profile</Button>
              <Button size="sm" variant="ghost" onClick={handleLogout}>Logout</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate('/register')}>Register</Button>
              <Button size="sm" onClick={() => navigate('/login')}>Login</Button>
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-card px-4 py-4 space-y-3">
          <Link to="/" className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>Home</Link>
          <Link to="/impact" className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>Impact</Link>
          <Link to="/privacy" className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>Privacy</Link>
          {isAuthenticated ? (
            <>
              {hasRole('admin') && <Link to="/admin" className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>Admin Dashboard</Link>}
              {hasRole('donor') && <Link to="/donor-portal" className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>Donor Portal</Link>}
              <Link to="/profile" className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>Profile</Link>
              <button onClick={() => { void handleLogout(); setMobileOpen(false); }} className="block text-sm font-medium text-destructive">Logout</button>
            </>
          ) : (
            <>
              <Link to="/register" className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>Register</Link>
              <Link to="/login" className="block text-sm font-medium text-primary" onClick={() => setMobileOpen(false)}>Login</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
