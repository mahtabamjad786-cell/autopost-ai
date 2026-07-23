import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      setPlan(data.plan);
    } catch {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  function login(token, userObj) {
    localStorage.setItem('token', token);
    setUser(userObj);
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, plan, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
