import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('rh_token');
    setUser(null);
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('rh:logout', onLogout);
    if (!localStorage.getItem('rh_token')) {
      setLoading(false);
    } else {
      api
        .me()
        .then((d) => setUser(d.user))
        .catch(() => logout())
        .finally(() => setLoading(false));
    }
    return () => window.removeEventListener('rh:logout', onLogout);
  }, [logout]);

  const persist = (data) => {
    localStorage.setItem('rh_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const value = {
    user,
    loading,
    isAdmin: user?.role === 'ADMIN',
    login: async (email, password) => persist(await api.login({ email, password })),
    signup: async (payload) => persist(await api.signup(payload)),
    logout,
    setUser
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
