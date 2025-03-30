import React, { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';
import CategoryManager from './CategoryManager';
import BudgetManager from './BudgetManager';
import '../css/FinanceTracker.css';

function FinanceTracker({
  totalBalance,
  clearTransactions,
  handleFileUpload,
  handleSort,
  sortOrder,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  filterCategory,
  setFilterCategory,
  months,
  years,
  categories,
  addTransaction,
  editingTransaction,
  saveEditTransaction,
  filteredTransactions,
  deleteTransaction,
  handleEditTransaction,
  archiveTransaction,
  calculateRunningBalance,
  addCategory,
  editCategory,
  deleteCategory,
  setTransactions,
  setStartingBalance,
}) {
  const [csvText, setCsvText] = useState('');
  const [showImportSection, setShowImportSection] = useState(false); // Toggle import section
  const [activeImportTab, setActiveImportTab] = useState('paste'); // Toggle between paste and file tabs
  const [showTransactionForm, setShowTransactionForm] = useState(false); // Toggle transaction form

  const handlePasteImport = () => {
    if (!csvText.trim()) {
      alert('Please paste CSV data to import.');
      return;
    }

    const Papa = require('papaparse');
    Papa.parse(csvText, {
      complete: (result) => {
        const data = result.data;
        let newStartingBalance = 0;
        if (filteredTransactions.length === 0 && data.length > 0 && data[0].Balance) {
          newStartingBalance = parseFloat(data[0].Balance.replace('$', '').replace(',', '')) || 0;
        }
        const imported = data
          .slice(1)
          .map((row, index) => {
            const amount = parseFloat(row.Amount?.replace('$', '').replace(',', ''));
            if (!row.Date || isNaN(amount)) return null;
            return {
              id: Date.now() + index,
              date: row.Date,
              category: row.Category || 'Uncategorized',
              description: row.Description || 'Imported',
              amount: Math.abs(amount).toString(),
              type: amount >= 0 ? 'income' : 'expense',
              isArchived: false,
            };
          })
          .filter(Boolean);
        setStartingBalance(newStartingBalance);
        setTransactions((prev) => [...prev, ...imported]);
        setCsvText('');
        setShowImportSection(false); // Hide the import section after successful import
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  return (
    <div className="content">
      <nav className="tracker-navbar">
        <Link to="/tracker" className="nav-link">Transactions</Link>
        <Link to="/tracker/categories" className="nav-link">Manage Categories</Link>
        <Link to="/tracker/budget" className="nav-link">Manage Budget</Link>
      </nav>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="balance">
                <h2>Balance: ${totalBalance.toFixed(2)}</h2>
                <button className="action-button clear-button" onClick={clearTransactions}>
                  Clear Transactions
                </button>
                <button className="action-button sort-button" onClick={handleSort}>
                  Sort by Date ({sortOrder === 'asc' ? 'Ascending' : 'Descending'})
                </button>
                <button
                  className="action-button"
                  onClick={() => setShowImportSection(!showImportSection)}
                >
                  {showImportSection ? 'Hide Import' : 'Import'}
                </button>
                <button
                  className="action-button"
                  onClick={() => setShowTransactionForm(!showTransactionForm)}
                >
                  {showTransactionForm ? 'Hide Add Transaction' : 'Add Transaction'}
                </button>
              </div>
              {showImportSection && (
                <div className="import-section">
                  <h3>Import Transactions</h3>
                  <div className="import-tabs">
                    <button
                      className={`tab-button ${activeImportTab === 'paste' ? 'active' : ''}`}
                      onClick={() => setActiveImportTab('paste')}
                    >
                      Paste CSV
                    </button>
                    <button
                      className={`tab-button ${activeImportTab === 'file' ? 'active' : ''}`}
                      onClick={() => setActiveImportTab('file')}
                    >
                      Import from File
                    </button>
                  </div>
                  <div className="import-content">
                    {activeImportTab === 'paste' && (
                      <div className="paste-import">
                        <textarea
                          value={csvText}
                          onChange={(e) => setCsvText(e.target.value)}
                          placeholder="Paste your CSV data here (e.g., Date,Category,Description,Amount,Balance)"
                          rows="5"
                          cols="50"
                        />
                        <button className="action-button" onClick={handlePasteImport}>
                          Import Pasted CSV
                        </button>
                      </div>
                    )}
                    {activeImportTab === 'file' && (
                      <div className="file-import">
                        <label htmlFor="fileInput" className="file-input-label">
                          Choose a CSV file:
                        </label>
                        <input
                          id="fileInput"
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="filters">
                <label>
                  Filter by Month:
                  <select
                    value={filterMonth ? filterMonth : 'All Months'}
                    onChange={(e) => setFilterMonth(e.target.value === 'All Months' ? '' : e.target.value.slice(0, 3))}
                  >
                    {months.map((m) => (
                      <option key={m} value={m === 'All Months' ? '' : m.slice(0, 3)}>{m}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Filter by Year:
                  <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Filter by Category:
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="All">All</option>
                    {categories.map((cat, index) => (
                      <option key={index} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
              </div>
              {showTransactionForm && (
                <TransactionForm
                  addTransaction={addTransaction}
                  editingTransaction={editingTransaction}
                  editTransaction={saveEditTransaction}
                  categories={categories}
                />
              )}
              <TransactionList
                transactions={filteredTransactions}
                deleteTransaction={deleteTransaction}
                editTransaction={handleEditTransaction}
                archiveTransaction={archiveTransaction}
                calculateBalance={calculateRunningBalance}
              />
            </>
          }
        />
        <Route
          path="categories"
          element={
            <CategoryManager
              categories={categories}
              addCategory={addCategory}
              editCategory={editCategory}
              deleteCategory={deleteCategory}
            />
          }
        />
        <Route
          path="budget"
          element={<BudgetManager categories={categories} addTransaction={addTransaction} />}
        />
      </Routes>
    </div>
  );
}

export default FinanceTracker;