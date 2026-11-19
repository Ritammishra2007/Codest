import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="bg-white border-b border-slate-300">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center space-x-6">
          <Link to="/" className="text-xl font-bold tracking-tight text-blue-700 hover:text-blue-800">
            Codest
          </Link>
          <span className="text-xs text-slate-500 hidden sm:inline border-l border-slate-300 pl-3">
            1v1 Python Programming Duels
          </span>
        </div>

        {/* Navigation & User Menu */}
        <div className="flex items-center space-x-4 text-sm">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="text-slate-700 hover:text-blue-600 font-medium">
                Dashboard
              </Link>
              <div className="h-4 w-px bg-slate-300" />
              <span className="text-slate-600 font-mono text-xs bg-slate-100 px-2 py-1 border border-slate-200 rounded">
                user: {user?.username}
              </span>
              <button
                onClick={handleLogout}
                className="text-slate-600 hover:text-red-700 text-sm font-medium"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-700 hover:text-blue-600 font-medium">
                Login
              </Link>
              <Link
                to="/register"
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
              >
                Register
              </Link>
            </>
          )}
        </div>

      </div>
    </header>
  );
}
