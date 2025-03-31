import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import CategoryManager from './components/CategoryManager';
import CheckbookSummary from './components/CheckbookSummary';
import './css/Checkbook.css';

function Checkbook() {
  // Transaction state
  const [transactions, setTransactions] = useState(() => {
    const savedTransactions = localStorage.getItem('transactions');
    return savedTransactions ? JSON.parse(savedTransactions) : [];
  });
  const [startingBalance, setStartingBalance] = useState(0);

  // Category state
  const [categories, setCategories] = useState(() => {
    const savedCategories = localStorage.getItem('categories');
    return savedCategories ? JSON.parse(savedCategories) : ['Uncategorized'];
  });

  // Filters and UI state
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortOrder, setSortOrder] = useState('desc');
  const [csvText, setCsvText] = useState('');
  const [showImportSection, setShowImportSection] = useState(false);
  const [activeImportTab, setActiveImportTab] = useState('paste');
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('categories', JSON.stringify(categories));
  }, [categories]);

  // Transaction management functions
  const addTransaction = (transaction) => {
    const amount = parseFloat(transaction.amount);
    const newTransaction = {
      ...transaction,
      id: Date.now(),
      amount: amount.toString(),
      type: amount >= 0 ? 'income' : 'expense',
      isArchived: false,
    };
    setTransactions((prev) => [...prev, newTransaction]);
  };

  const deleteTransaction = (id) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const archiveTransaction = (id) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isArchived: !t.isArchived } : t))
    );
  };

  const saveEditTransaction = (updatedTransaction) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updatedTransaction.id ? updatedTransaction : t))
    );
  };

  const handleEditTransaction = (transaction) => {
    return transaction; // For TransactionForm to handle editing
  };

  const clearTransactions = () => {
    if (window.confirm('Are you sure you want to clear all transactions?')) {
      setTransactions([]);
      setStartingBalance(0);
    }
  };

  // Category management functions
  const addCategory = (newCategory) => {
    if (!categories.includes(newCategory)) {
      setCategories((prev) => [...prev, newCategory]);
    }
  };

  const editCategory = (oldCat, newCat) => {
    if (!categories.includes(newCat)) {
      setCategories((prev) => prev.map((cat) => (cat === oldCat ? newCat : cat)));
      setTransactions((prev) =>
        prev.map((t) => (t.category === oldCat ? { ...t, category: newCat } : t))
      );
    }
    return transactions; // Return updated transactions for consistency
  };

  const deleteCategory = (cat) => {
    if (categories.length > 1 && cat !== 'Uncategorized') {
      setCategories((prev) => prev.filter((c) => c !== cat));
      setTransactions((prev) =>
        prev.map((t) => (t.category === cat ? { ...t, category: 'Uncategorized' } : t))
      );
    }
    return transactions; // Return updated transactions
  };

  // Filtering and sorting logic
  const filteredTransactions = transactions
    .filter((t) => {
      const date = new Date(t.date);
      return (
        (!filterMonth || date.toLocaleString('default', { month: 'short' }) === filterMonth) &&
        (!filterYear || date.getFullYear().toString() === filterYear) &&
        (filterCategory === 'All' || t.category === filterCategory)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  const calculateRunningBalance = (index) => {
    const slicedTransactions = filteredTransactions.slice(0, index + 1);
    return slicedTransactions.reduce((acc, curr) => {
      const amount = parseFloat(curr.amount);
      return curr.type === 'income' ? acc + amount : acc - Math.abs(amount);
    }, startingBalance);
  };

  const totalBalance = filteredTransactions.reduce((acc, curr) => {
    const amount = parseFloat(curr.amount);
    return curr.type === 'income' ? acc + amount : acc - Math.abs(amount);
  }, startingBalance);

  const handleSort = () => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');

  const months = ['All Months', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const years = Array.from(
    { length: 10 },
    (_, i) => new Date().getFullYear() - 5 + i
  ).filter((y) => y >= 2000);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const Papa = require('papaparse');
        Papa.parse(event.target.result, {
          complete: (result) => {
            const data = result.data;
            let newStartingBalance = startingBalance;
            if (transactions.length === 0 && data.length > 0 && data[0].Balance) {
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
            setShowImportSection(false);
          },
          header: true,
          skipEmptyLines: true,
        });
      };
      reader.readAsText(file);
    }
  };

  const handlePasteImport = () => {
    if (!csvText.trim()) {
      alert('Please paste CSV data to import.');
      return;
    }
    const Papa = require('papaparse');
    Papa.parse(csvText, {
      complete: (result) => {
        const data = result.data;
        let newStartingBalance = startingBalance;
        if (transactions.length === 0 && data.length > 0 && data[0].Balance) {
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
        setShowImportSection(false);
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  return (
    <div className="content">
      <nav className="checkbook-navbar">
        <Link to="/checkbook" className="nav-link">Transactions</Link>
        <Link to="/checkbook/categories" className="nav-link">Manage Categories</Link>
        <Link to="/checkbook/budget" className="nav-link">Manage Budget</Link>
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
                  editingTransaction={null} // Handle editing within TransactionList
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
          element={<CheckbookSummary categories={categories} addTransaction={addTransaction} />}
        />
      </Routes>
    </div>
  );
}

export default Checkbook;