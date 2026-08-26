import { User } from '../types';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-bold text-gray-900">Email Scheduler</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {user.avatar && (
            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
          )}
          <div className="text-sm">
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-gray-500">{user.email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-3 py-1.5"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
