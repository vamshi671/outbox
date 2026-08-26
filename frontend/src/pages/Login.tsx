import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { api } from '../api';
import { User } from '../types';
import toast from 'react-hot-toast';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const handleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) return;
    try {
      const res = await api.post('/auth/google', { token: response.credential });
      onLogin(res.data.user, response.credential);
    } catch {
      toast.error('Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Scheduler</h1>
        <p className="text-gray-500 mb-8">Sign in to manage your email campaigns</p>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => toast.error('Login failed')}
            size="large"
            width="300"
          />
        </div>
      </div>
    </div>
  );
}
