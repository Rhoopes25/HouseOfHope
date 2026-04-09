import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { User, UserRole } from '@/lib/types';
import { getAuthSession, loginUser, logoutUser } from '@/lib/authAPI';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasRole: (role: UserRole) => boolean;
  refreshAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionRoles, setSessionRoles] = useState<string[]>([]);

  const mapRole = (roles: string[]): UserRole => {
    if (roles.some(r => r.toLowerCase() === 'admin')) return 'admin';
    if (roles.some(r => r.toLowerCase() === 'donor')) return 'donor';
    return 'public';
  };

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const session = await getAuthSession();
      if (!session.isAuthenticated) {
        setUser(null);
        setSessionRoles([]);
        return false;
      }
      setSessionRoles(session.roles);
      setUser({
        id: session.email ?? session.userName ?? 'session-user',
        username: session.email ?? session.userName ?? '',
        displayName: session.supporterDisplayName ?? session.userName ?? session.email ?? 'User',
        role: mapRole(session.roles),
      });
      return true;
    } catch {
      setUser(null);
      setSessionRoles([]);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      await loginUser(username, password);
      const ok = await refreshAuth();
      if (!ok) {
        return {
          success: false,
          error:
            'Login did not keep you signed in. If the API is on a different domain than this site, the server must use SameSite=None and Secure for auth cookies, and CORS must allow this origin with credentials.',
        };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
    }
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const hasRole = useCallback((role: UserRole) => {
    return sessionRoles.some(r => r.toLowerCase() === role.toLowerCase());
  }, [sessionRoles]);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading, hasRole, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
