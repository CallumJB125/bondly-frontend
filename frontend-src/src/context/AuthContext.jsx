import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { setToken, clearToken, getDecodedToken, auth } from '../lib/api.js';
import { getSessionId, identifyUser } from '../lib/session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // { userId, name, email, role }
  const [loading, setLoading] = useState(true);

  // Hydrate from token on mount, then validate with server to catch revoked/stale sessions
  useEffect(() => {
    const decoded = getDecodedToken();
    if (!decoded || (decoded.exp && decoded.exp * 1000 < Date.now())) {
      clearToken();
      setLoading(false);
      return;
    }
    // Optimistically set user so the UI renders immediately, then confirm with server
    setUser(decoded);
    auth.me().then(data => {
      setUser({
        name:       data.name  || decoded.name,
        email:      data.email || decoded.email,
        role:       data.role  || decoded.role || 'customer',
        userId:     data.id    || decoded.userId,
        superAdmin: data.superAdmin || false,
      });
      // Silently refresh if token expires within 5 days
      if (decoded.exp && (decoded.exp * 1000 - Date.now()) < 5 * 24 * 60 * 60 * 1000) {
        auth.refresh().then(r => { if (r?.token) setToken(r.token); }).catch(() => {});
      }
    }).catch(() => {
      clearToken();
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await auth.login(email, password);
    setToken(data.token);
    // C-4: Use server-returned role, not decoded token payload (token not verified client-side)
    setUser({
      name:       data.user?.name  || email,
      email:      data.user?.email || email,
      role:       data.role || data.user?.role || 'customer',
      userId:     data.user?.id,
      superAdmin: data.user?.superAdmin || false,
    });
    return data;
  }, []);

  const register = useCallback(async (name, email, password, referralCode, phone) => {
    const anonSessionId = getSessionId();
    const data = await auth.register(name, email, password, referralCode, anonSessionId, phone);
    if (data.token) {
      setToken(data.token);
      setUser({ name, email, role: 'customer' });
      if (data.user?.id) identifyUser(data.user.id);
    }
    return data;
  }, []);

  const loginWithToken = useCallback((tokenStr, userData) => {
    setToken(tokenStr);
    // C-4: userData comes from server response — role is server-authoritative
    setUser({ role: 'customer', ...userData });
  }, []);

  const logout = useCallback(() => {
    // Tell the server to revoke this token, then clear locally
    auth.logout().catch(() => {});
    clearToken();
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isLoggedIn: !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    loginWithToken,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
