import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Checkbook from './features/checkbook/Checkbook'; // FinanceTracker
import InvestmentTracker from './features/investments/InvestmentTracker';
import TradesList from './features/investments/components/TradesList';
import './shared/css/App.css';

/**
 * Main App component with routing and state management.
 */
function App() {
  return (
    <AppProvider>
      <Router>
        <div className="app">
          <nav className="navbar">
            <h1>My Personal Tracker</h1>
            <div className="nav-links">
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Home
              </NavLink>
              <NavLink to="/checkbook" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Checkbook
              </NavLink>
              <NavLink to="/investments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Investments
              </NavLink>
            </div>
          </nav>
          <Routes>
            <Route
              path="/"
              element={
                <div className="home">
                  <h2>Welcome to MPT</h2>
                  <p>Track your finances and manage your budget with ease.</p>
                </div>
              }
            />
            <Route path="/checkbook/*" element={<Checkbook />} />
            <Route path="/investments" element={<InvestmentTracker />} />
            <Route path="/trades" element={<TradesList />} />
            <Route path="" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;