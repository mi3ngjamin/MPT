import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { BudgetProvider } from './components/BudgetContext';
import FinanceTracker from './components/FinanceTracker';
import InvestmentTracker from './components/InvestmentTracker';
import TradesList from './components/TradesList'; 
import useTransactions from './hooks/useTransactions';
import useCategories from './hooks/useCategories';
import './App.css';

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
    <BudgetProvider>
      <Router>
        <div className="app">
          <nav className="navbar">
            <h1>My Personal Tracker</h1>
            <div className="nav-links">
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Home
              </NavLink>
              <NavLink to="/tracker" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
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
              path="/tracker/*"
              element={
                <FinanceTracker
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
    </BudgetProvider>
  );
}

export default App;