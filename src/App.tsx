import { useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return session ? <Dashboard /> : <LoginPage />;
}
