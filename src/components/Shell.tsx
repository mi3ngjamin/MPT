import {
  CalendarDays,
  LayoutDashboard,
  LineChart,
  List,
  Moon,
  PiggyBank,
  Settings,
  Sun,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true },
  { to: '/investments', label: 'Investments', short: 'Invest', icon: LineChart, end: false },
  { to: '/activity', label: 'Activity', short: 'Activity', icon: List, end: false },
  { to: '/checking', label: 'Checking', short: 'Cash', icon: Wallet, end: false },
  { to: '/budget', label: 'Budget', short: 'Budget', icon: PiggyBank, end: false },
  { to: '/bills', label: 'Bills', short: 'Bills', icon: CalendarDays, end: false },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings, end: false },
];

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const current = NAV.find((item) => (item.end ? pathname === '/' : pathname.startsWith(item.to)));
  const { theme, setTheme } = useTheme();
  const finance = useFinance();
  const auth = useAuth();
  const whatIf = finance.snapshot.preferences.priceMode === 'what_if';

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    void finance.saveTheme(next);
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-panel/80 px-4 py-5 backdrop-blur lg:flex">
        <div className="px-2">
          <p className="text-xl font-semibold tracking-tight">MPT</p>
          <p className="text-xs text-muted">Personal finance</p>
        </div>
        <nav className="mt-8 space-y-1" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <item.icon size={18} aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 px-2">
          <button type="button" className="btn-ghost w-full justify-between" onClick={() => void finance.setPriceMode(whatIf ? 'live' : 'what_if')}>
            <span>{whatIf ? 'What-if prices' : 'Live prices'}</span>
            <span className={`h-2 w-2 rounded-full ${whatIf ? 'bg-warn' : 'bg-gain'}`} />
          </button>
          <button type="button" className="btn-ghost w-full" onClick={toggleTheme} aria-label="Toggle color theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <p className="truncate px-1 text-xs text-muted">{finance.demo ? 'Sample data' : auth.email}</p>
        </div>
      </aside>
      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur lg:hidden">
          <div>
            <p className="text-xs text-muted">MPT</p>
            <p className="font-semibold">{current?.label ?? 'MPT'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => void finance.setPriceMode(whatIf ? 'live' : 'what_if')}>
              {whatIf ? 'What-if' : 'Live'}
            </button>
            <button type="button" className="btn-ghost px-2 py-2" onClick={toggleTheme} aria-label="Toggle color theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>
        {finance.demo ? (
          <p className="bg-accent/15 px-4 py-2 text-center text-xs font-medium text-ink">Sample data. Nothing here is a real account.</p>
        ) : null}
        {finance.error ? <p className="bg-loss/15 px-4 py-2 text-sm text-loss">{finance.error}</p> : null}
        {finance.notice ? (
          <button type="button" className="block w-full bg-accent/10 px-4 py-2 text-left text-sm" onClick={() => finance.setNotice(null)}>
            {finance.notice}
          </button>
        ) : null}
        {finance.legacyAvailable ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3 text-sm">
            <p>This browser still has the old MPT data. Import it once, or leave it.</p>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={() => void finance.importLegacy()}>
                Import
              </button>
              <button type="button" className="btn-ghost" onClick={() => void finance.dismissLegacy()}>
                Not now
              </button>
            </div>
          </div>
        ) : null}
        <main className="page mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-line bg-panel/95 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden" aria-label="Primary">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium ${isActive ? 'text-accent' : 'text-muted'}`}
          >
            <item.icon size={18} aria-hidden />
            {item.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
