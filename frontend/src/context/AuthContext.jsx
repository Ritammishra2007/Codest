import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('codest_token') || null);
  const [loading, setLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    async function initSession() {
      try {
        const storedToken = localStorage.getItem('codest_token');
        if (storedToken) {
          const res = await authApi.getMe();
          if (res.success && res.user) {
            setUser(res.user);
            setToken(storedToken);
          } else {
            logout();
          }
        }
      } catch (err) {
        console.error('Session restore error:', err);
        logout();
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, []);

  const login = async (usernameOrEmail, password) => {
    const res = await authApi.login(usernameOrEmail, password);
    if (res.success) {
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem('codest_token', res.token);
    }
    return res;
  };

  const register = async (username, email, password) => {
    const res = await authApi.register(username, email, password);
    if (res.success) {
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem('codest_token', res.token);
    }
    return res;
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
