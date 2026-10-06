import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, AuthApiError } from '../services/authApi';
import type {
  AmbulanceDriverRegistrationRequest,
  AmbulanceProviderRegistrationRequest,
  AuthState,
  AuthUser,
  HospitalRegistrationRequest,
  LoginRequest,
  UserRegistrationRequest,
  UserRole,
} from '../types/auth';

interface AuthContextValue extends AuthState {
  role: UserRole | null;
  login: (input: LoginRequest) => Promise<AuthUser>;
  register: {
    user: (input: UserRegistrationRequest) => Promise<AuthUser>;
    hospital: (input: HospitalRegistrationRequest) => Promise<AuthUser>;
    ambulanceProvider: (input: AmbulanceProviderRegistrationRequest) => Promise<AuthUser>;
    ambulanceDriver: (input: AmbulanceDriverRegistrationRequest) => Promise<AuthUser>;
  };
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const getUserFromResponse = (response: { data: { user: AuthUser } }): AuthUser => response.data.user;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const setAuthenticatedUser = useCallback((user: AuthUser | null) => {
    setState({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
    });
  }, []);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const response = await authApi.me();
      const user = response.data;
      setAuthenticatedUser(user);
      return user;
    } catch (error) {
      if (!(error instanceof AuthApiError) || error.status !== 401) {
        setAuthenticatedUser(null);
        throw error;
      }

      try {
        const refreshed = await authApi.refresh();
        const user = getUserFromResponse(refreshed);
        setAuthenticatedUser(user);
        return user;
      } catch (refreshError) {
        setAuthenticatedUser(null);
        if (refreshError instanceof AuthApiError && refreshError.status === 401) return null;
        throw refreshError;
      }
    }
  }, [setAuthenticatedUser]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void refreshUser().catch(() => {
      setAuthenticatedUser(null);
    });
  }, [refreshUser, setAuthenticatedUser]);

  const login = useCallback(async (input: LoginRequest): Promise<AuthUser> => {
    const response = await authApi.login(input);
    const user = getUserFromResponse(response);
    setAuthenticatedUser(user);
    return user;
  }, [setAuthenticatedUser]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setAuthenticatedUser(null);
    }
  }, [setAuthenticatedUser]);

  const registerUser = useCallback(async (input: UserRegistrationRequest) => {
    const response = await authApi.registerUser(input);
    return response.data;
  }, []);

  const registerHospital = useCallback(async (input: HospitalRegistrationRequest) => {
    const response = await authApi.registerHospital(input);
    return response.data;
  }, []);

  const registerAmbulanceProvider = useCallback(async (input: AmbulanceProviderRegistrationRequest) => {
    const response = await authApi.registerAmbulanceProvider(input);
    return response.data;
  }, []);

  const registerAmbulanceDriver = useCallback(async (input: AmbulanceDriverRegistrationRequest) => {
    const response = await authApi.registerAmbulanceDriver(input);
    return response.data;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    role: state.user?.role ?? null,
    login,
    register: {
      user: registerUser,
      hospital: registerHospital,
      ambulanceProvider: registerAmbulanceProvider,
      ambulanceDriver: registerAmbulanceDriver,
    },
    logout,
    refreshUser,
  }), [state, login, registerUser, registerHospital, registerAmbulanceProvider, registerAmbulanceDriver, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
