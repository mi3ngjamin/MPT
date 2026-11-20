import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider } from './context/FinanceContext';
import { ThemeProvider } from './context/ThemeContext';
import ActivityPage from './pages/Activity';
import Bills from './pages/Bills';
import Budget from './pages/Budget';
import Checking from './pages/Checking';
import Dashboard from './pages/Dashboard';
import Investments from './pages/Investments';
import Settings from './pages/Settings';
import SignIn from './pages/SignIn';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  const requestedDemo = new URLSearchParams(window.location.search).has('demo');
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-2xl font-semibold tracking-tight">MPT</p>
      </div>
    );
  }
  const demo = requestedDemo && !session;
  if (!session && !demo) return <SignIn />;
  return (
    <FinanceProvider demo={demo}>
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/checking" element={<Checking />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/bills" element={<Bills />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </HashRouter>
    </FinanceProvider>
  );
}
