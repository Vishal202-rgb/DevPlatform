import { createContext, useCallback, useEffect, useState } from 'react';
import {
  registerRequest,
  loginRequest,
  logoutRequest,
  fetchCurrentUser,
} from '../services/authService';

const TOKEN_KEY = 'devplatform_token';

export const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true while checking existing session
  const [error, setError] = useState(null);

  // On first load, if a token exists, try to hydrate the session
  useEffect(() => {
    const hydrate = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
      } catch (err) {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    hydrate();
  }, []);

  const register = useCallback(async (payload) => {
    setError(null);
    const { user: newUser, token } = await registerRequest(payload);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(newUser);
    return newUser;
  }, []);

  const login = useCallback(async (payload) => {
    setError(null);
    const { user: loggedInUser, token } = await loginRequest(payload);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch (err) {
      // even if the server call fails, clear local state
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    setError,
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
