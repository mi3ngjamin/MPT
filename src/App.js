import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Checkbook from './features/checkbook/Checkbook';
import InvestmentTracker from './features/investments/InvestmentTracker';
import TradesList from './features/investments/components/TradesList';
import PriceManager from './features/investments/components/PriceManager';
import './shared/css/App.css';

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <AppProvider>
      <Router>
        <div className="app">
          <nav className="navbar">
            <h1>My Personal Tracker</h1>

            {/* Hamburger button - only visible on mobile */}
            <button
              className="menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>

            {/* Navigation links */}
            <div className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
              <NavLink
                to="/"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                Home
              </NavLink>
              <NavLink
                to="/checkbook"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                Checkbook
              </NavLink>
              <NavLink
                to="/investments"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
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
            <Route path="/prices" element={<PriceManager />} />
            <Route path="" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;