import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/types';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, hasRole, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-warm">
        <div className="text-center p-12 bg-card rounded-xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Unauthorized Access</h1>
          <p className="text-muted-foreground mb-6">You do not have permission to access this page.</p>
          <a href="/" className="text-primary hover:underline font-medium">Return to Home</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
