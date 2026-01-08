import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useInvestments from '../hooks/useInvestments.js';
import '../css/TradesList.css';
import Papa from 'papaparse';

const TradesList = () => {
  const {
    filteredInvestments,
    accounts,
    sortOrder,
    setSortOrder,
    filterAccount,
    setFilterAccount,
    addInvestment,
    importInvestments,
    clearInvestments,
    deleteInvestment,
    setInvestments,
  } = useInvestments();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    account: '',
    ticker: '',
    shares: '',
    price: '',
    date: '',
    transactionType: 'BUY',
  });
  const [csvText, setCsvText] = useState('');
  const [showImportSection, setShowImportSection] = useState(false);
  const [activeImportTab, setActiveImportTab] = useState('paste');
  const [expandedRow, setExpandedRow] = useState(null); // For mobile accordion

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const shares = parseFloat(formData.shares);
    const price = parseFloat(formData.price);
    if (isNaN(shares) || isNaN(price) || shares <= 0 || price <= 0) {
      alert('Shares and Price must be positive numbers.');
      return;
    }

    const updatedInvestment = {
      id: editingTransaction ? editingTransaction.id : Date.now(),
      account: formData.account,
      ticker: formData.ticker,
      shares,
      price,
      date: formData.date,
      transactionType: formData.transactionType,
    };

    if (editingTransaction) {
      setInvestments((prev) =>
        prev.map((inv) =>
          inv.id === editingTransaction.id ? updatedInvestment : inv
        )
      );
    } else {
      addInvestment(updatedInvestment);
    }

    setFormData({ account: '', ticker: '', shares: '', price: '', date: '', transactionType: 'BUY' });
    setEditingTransaction(null);
    setIsFormOpen(false);
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      account: transaction.account,
      ticker: transaction.ticker,
      shares: transaction.shares.toString(),
      price: transaction.price.toString(),
      date: transaction.date,
      transactionType: transaction.transactionType,
    });
    setIsFormOpen(true);
    setExpandedRow(null); // Close mobile accordion when editing
  };

  const handleExportToCSV = () => {
    if (filteredInvestments.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const dataToExport = filteredInvestments.map((inv) => ({
      Account: inv.account,
      TransactionDate: inv.date,
      TransactionType: inv.transactionType,
      Ticker: inv.ticker,
      Shares: inv.shares,
      Price: inv.price,
      TotalCost: inv.totalCost || (inv.shares * inv.price),
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'trades_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePasteImport = () => {
    if (!csvText.trim()) {
      alert('Please paste CSV data to import.');
      return;
    }

    Papa.parse(csvText, {
      complete: (result) => {
        const rows = result.data;
        if (rows.length <= 1) {
          alert('The CSV data contains no valid rows.');
          return;
        }

        const importedInvestments = rows
          .map((row, index) => {
            const shares = parseFloat(row.Shares);
            const price = parseFloat(row.Price);
            const totalCost = parseFloat(row.TotalCost);

            if (!row.Account || !row.Ticker || isNaN(shares) || isNaN(price)) {
              console.warn(`Skipping invalid row ${index + 1}:`, row);
              return null;
            }

            return {
              id: Date.now() + index,
              account: row.Account?.trim(),
              date: row.TransactionDate?.trim(),
              transactionType: row.TransactionType?.trim(),
              ticker: row.Ticker?.trim(),
              shares,
              price,
              totalCost: isNaN(totalCost) ? 0 : totalCost,
            };
          })
          .filter((inv) => inv !== null);

        if (importedInvestments.length === 0) {
          alert('No valid transactions were found in the CSV data.');
          return;
        }

        importInvestments(importedInvestments);
        setCsvText('');
        setShowImportSection(false);
        alert(`Successfully imported ${importedInvestments.length} transactions.`);
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      if (!text || typeof text !== 'string') {
        alert('The CSV file is empty or invalid.');
        return;
      }

      const rows = text.split('\n').map((row) => row.trim()).filter((row) => row);
      if (rows.length <= 1) {
        alert('The CSV file contains no data rows.');
        return;
      }

      const importedInvestments = rows.slice(1).map((row, index) => {
        const columns = row.split(',');
        if (columns.length < 7) return null;

        const shares = parseFloat(columns[4]);
        const price = parseFloat(columns[5]);
        const totalCost = parseFloat(columns[6]);

        if (!columns[0] || !columns[3] || isNaN(shares) || isNaN(price)) return null;

        return {
          id: Date.now() + index,
          account: columns[0].trim(),
          date: columns[1]?.trim(),
          transactionType: columns[2]?.trim(),
          ticker: columns[3].trim(),
          shares,
          price,
          totalCost: isNaN(totalCost) ? 0 : totalCost,
        };
      }).filter((inv) => inv !== null);

      if (importedInvestments.length === 0) {
        alert('No valid transactions found in CSV.');
        return;
      }

      importInvestments(importedInvestments);
      setShowImportSection(false);
      alert(`Imported ${importedInvestments.length} transactions.`);
    };

    reader.onerror = () => alert('Error reading file.');
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all entries?')) {
      clearInvestments();
    }
  };

  const handleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="trades-list">
      <div className="trades-header">
        <div className="header-top">
          <div className="header-content">
            <h2>Investment Transactions</h2>
            <Link to="/investments" className="back-button">
              ← Back
            </Link>
          </div>
        </div>
      </div>

      {/* <div className="action-buttons">
        <button onClick={() => setIsFormOpen(true)} className="action-button">
          {editingTransaction ? 'Edit Transaction' : 'Add a Transaction'}
        </button>
        <button onClick={() => setShowImportSection(!showImportSection)} className="action-button">
          {showImportSection ? 'Hide Import' : 'Import'}
        </button>
        <button onClick={handleExportToCSV} className="action-button export-button">
          Export to CSV
        </button>
        <button onClick={handleClearAll} className="action-button clear-button">
          Clear All Entries
        </button>
      </div> */}
      {/* Floating Action Button + Menu */}
      <div className="fab-container">
        <button
          className="fab-main"
          onClick={() => setIsFormOpen(true)}
          aria-label="Add transaction"
        >
          +
        </button>

        {/* Hidden menu - opens on hover/focus (desktop) or tap (mobile) */}
        <div className="fab-menu">
          <button
            onClick={() => setShowImportSection(true)}
            className="fab-item import-item"
            title="Import transactions"
          >
            📥 Import
          </button>
          <button
            onClick={handleExportToCSV}
            className="fab-item export-item"
            title="Export to CSV"
          >
            📤 Export
          </button>
          <button
            onClick={handleClearAll}
            className="fab-item clear-item"
            title="Clear all entries"
          >
            🗑️ Clear All
          </button>
        </div>
      </div>
      {/* Import Section */}
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
                  placeholder="Paste CSV here (Account,TransactionDate,TransactionType,Ticker,Shares,Price,TotalCost)"
                  rows="5"
                />
                <button className="action-button" onClick={handlePasteImport}>
                  Import Pasted CSV
                </button>
              </div>
            )}
            {activeImportTab === 'file' && (
              <div className="file-import">
                <label>Choose a CSV file:</label>
                <input type="file" accept=".csv" onChange={handleCSVImport} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="investment-form">
          <div className="form-group">
            <label>Account:</label>
            <input type="text" name="account" value={formData.account} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Ticker:</label>
            <input type="text" name="ticker" value={formData.ticker} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Shares:</label>
            <input type="number" name="shares" value={formData.shares} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Price:</label>
            <input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Date (MM/DD/YYYY):</label>
            <input type="text" name="date" value={formData.date} onChange={handleChange} required placeholder="e.g., 1/15/2025" />
          </div>
          <div className="form-group">
            <label>Transaction Type:</label>
            <select name="transactionType" value={formData.transactionType} onChange={handleChange}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="submit" className="action-button">
              {editingTransaction ? 'Update' : 'Add'} Transaction
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingTransaction(null);
                setFormData({ account: '', ticker: '', shares: '', price: '', date: '', transactionType: 'BUY' });
              }}
              className="action-button cancel-button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="filters">
        <div className="filter-group">
          <label>
            Account:
            <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
              <option value="All">All Accounts</option>
              {accounts?.map((account, i) => (
                <option key={i} value={account}>{account}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-group">
          <button className="sort-toggle-button" onClick={handleSort}>
            <span className="sort-label">Date</span>
            <span className="sort-direction">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          </button>
        </div>
      </div>

      {/* Transactions List */}
      {filteredInvestments.length > 0 ? (
        <>
          {/* Desktop Table - hidden on mobile */}
          <div className="desktop-table">
            <table className="trades-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Ticker</th>
                  <th>Shares</th>
                  <th>Price</th>
                  <th>Total Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestments.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.account}</td>
                    <td>{transaction.date}</td>
                    <td>{transaction.transactionType}</td>
                    <td>{transaction.ticker}</td>
                    <td>{transaction.shares.toFixed(2)}</td>
                    <td>${transaction.price.toFixed(2)}</td>
                    <td>
                      ${transaction.totalCost
                        ? transaction.totalCost.toFixed(2)
                        : (transaction.shares * transaction.price).toFixed(2)}
                    </td>
                    <td>
                      <button onClick={() => handleEdit(transaction)} className="edit-button">Edit</button>
                      <button onClick={() => deleteInvestment(transaction.id)} className="delete-button">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Accordion - Compact 2-line cards */}
          <div className="mobile-accordion">
            {filteredInvestments.map((transaction) => {
              const total = transaction.totalCost || (transaction.shares * transaction.price);
              const isExpanded = expandedRow === transaction.id;
              const isBuy = transaction.transactionType === 'BUY';

              return (
                <div
                  key={transaction.id}
                  className={`accordion-item ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => toggleRow(transaction.id)}
                >
                  <div className="accordion-compact">
                    {/* Line 1: Date + Account */}
                    <div className="compact-line-1">
                      <span className="transaction-date">{transaction.date}</span>
                      <span className="transaction-account">{transaction.account}</span>
                    </div>

                    {/* Line 2: Ticker + Type + Shares@Price + Total */}
                    <div className="compact-line-2">
                      <div className="left-info">
                        <strong className="ticker">{transaction.ticker}</strong>
                        <span className={`transaction-type ${isBuy ? 'buy' : 'sell'}`}>
                          {transaction.transactionType}
                        </span>
                        <span className="shares-price">
                          {transaction.shares.toFixed(0)} shares @ ${transaction.price.toFixed(2)}
                        </span>
                      </div>
                      <div className="right-info">
                        <span className="total-amount">${total.toFixed(2)}</span>
                        <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="accordion-body">
                      <div><strong>Full Price:</strong> ${transaction.price.toFixed(2)} per share</div>
                      <div><strong>Total Cost/Basis:</strong> ${total.toFixed(2)}</div>
                      <div className="accordion-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(transaction);
                          }}
                          className="edit-button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteInvestment(transaction.id);
                          }}
                          className="delete-button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
</div>
        </>
      ) : (
        <p>No transactions to display. Add a transaction or import a CSV file.</p>
      )}
    </div>
  );
};

export default TradesList;