import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe, login as apiLogin, register as apiRegister } from '../api/auth';
import { useToast } from './ToastContext';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const userData = await getMe();
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          console.error("Token validation failed", error);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const data = await apiLogin(username, password);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      
      const userData = await getMe();
      setUser(userData);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      const msg = error.response?.data?.detail || 'Login failed';
      return { success: false, error: msg };
    }
  };

  const register = async (username, email, password) => {
    try {
      await apiRegister(username, email, password);
      // Auto login after register
      return await login(username, password);
    } catch (error) {
      const msg = error.response?.data?.detail || 'Registration failed';
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setIsAuthenticated(false);
    showToast('Berhasil keluar', 'info');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, register, logout, isAdmin: user?.role === 'admin', role: user?.role }}>
      {children}
    </AuthContext.Provider>
  );
};
