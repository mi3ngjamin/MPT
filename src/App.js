import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext'; // Updated
import Checkbook from './features/checkbook/components/Checkbook'; // Updated
import useTransactions from './features/checkbook/hooks/useTransactions'; // Updated
import useCategories from './features/checkbook/hooks/useCategories'; // Updated

import InvestmentTracker from './features/investments/components/InvestmentTracker'; // Updated
import TradesList from './features/investments/components/TradesList'; // Updated

import './shared/css/App.css'; // Updated

/**
 * Main App component with routing and state management.
 */
function App() {
  const transactionData = useTransactions();
  const { transactions, setTransactions } = transactionData; // Destructure only what's used here
  const { categories, addCategory, editCategory, deleteCategory } = useCategories(transactions);

  const updateTransactionsFromCategories = (updatedTransactions) => {
    setTransactions(updatedTransactions);
  };

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
            <Route
              path="/checkbook/*"
              element={
                <Checkbook
                  {...transactionData} // Includes addTransaction for future use
                  categories={categories}
                  addCategory={addCategory}
                  editCategory={(oldCat, newCat) => updateTransactionsFromCategories(editCategory(oldCat, newCat))}
                  deleteCategory={(cat) => updateTransactionsFromCategories(deleteCategory(cat))}
                />
              }
            />
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