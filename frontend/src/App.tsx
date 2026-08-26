import { useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { setAuthToken } from './api';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function App() {
  const { user, token, login, logout, isAuthenticated } = useAuth();

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Toaster position="top-right" />
      {isAuthenticated && user ? (
        <Dashboard user={user} onLogout={logout} />
      ) : (
        <Login onLogin={login} />
      )}
    </GoogleOAuthProvider>
  );
}
