import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useLivePrices from '../hooks/useLivePrices';
import '../css/PriceManager.css';

const PriceManager = () => {
  const [tickers, setTickers] = useState([]);
  const { livePrices, loading, fetchLivePrices, savePrices } = useLivePrices(tickers);
  const [newTicker, setNewTicker] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [editingTicker, setEditingTicker] = useState(null);
  const [editingPrice, setEditingPrice] = useState('');
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    const currentTickers = Object.keys(livePrices);
    setTickers(currentTickers);
  }, [livePrices]);

  useEffect(() => {
    if (tickers.length > 0 && !hasFetched) {
      fetchLivePrices();
      setHasFetched(true);
    }
  }, [tickers, hasFetched, fetchLivePrices]);

  const handleAddTicker = (e) => {
    e.preventDefault();
    if (!newTicker.trim() || !newPrice.trim()) {
      alert('Please enter both a ticker and a price.');
      return;
    }

    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      alert('Price must be a positive number.');
      return;
    }

    const updatedPrices = { ...livePrices, [newTicker.toUpperCase()]: price };
    savePrices(updatedPrices);
    setNewTicker('');
    setNewPrice('');
  };

  const handleEditPrice = (ticker) => {
    setEditingTicker(ticker);
    setEditingPrice(livePrices[ticker].toString());
  };

  const handleSaveEdit = (ticker) => {
    const price = parseFloat(editingPrice);
    if (isNaN(price) || price <= 0) {
      alert('Price must be a positive number.');
      return;
    }

    const updatedPrices = { ...livePrices, [ticker]: price };
    savePrices(updatedPrices);
    setEditingTicker(null);
    setEditingPrice('');
  };

  const handleDeleteTicker = (ticker) => {
    if (window.confirm(`Delete ${ticker} from tracked prices?`)) {
      const updatedPrices = { ...livePrices };
      delete updatedPrices[ticker];
      savePrices(updatedPrices);
    }
  };

  const formatCurrency = (value) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="price-manager">
      {/* Header with Back Button */}
      <div className="page-header">
        <h2>Manage Tracked Prices</h2>
        <Link to="/investments" className="back-button">
          ← Back to Investments
        </Link>
      </div>

      {/* Add Ticker Form */}
      <div className="add-ticker-card">
        <h3>Add New Ticker Price</h3>
        <form onSubmit={handleAddTicker} className="add-ticker-form">
          <div className="form-group">
            <label>Ticker</label>
            <input
              type="text"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              placeholder="e.g., SWPPX"
              required
            />
          </div>
          <div className="form-group">
            <label>Custom Price ($)</label>
            <input
              type="number"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="e.g., 100.00"
              required
            />
          </div>
          <button type="submit" className="add-button">
            Add Ticker
          </button>
        </form>
      </div>

      {/* Tracked Prices List */}
      <div className="price-list-card">
        <h3>Tracked Custom Prices ({Object.keys(livePrices).length})</h3>
        {Object.keys(livePrices).length > 0 ? (
          <div className="price-grid">
            {Object.entries(livePrices).map(([ticker, price]) => (
              <div key={ticker} className="price-item">
                <div className="price-info">
                  <strong className="ticker">{ticker}</strong>
                  {editingTicker === ticker ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editingPrice}
                      onChange={(e) => setEditingPrice(e.target.value)}
                      className="edit-input"
                      autoFocus
                    />
                  ) : (
                    <span className="price-value">{formatCurrency(price)}</span>
                  )}
                </div>
                <div className="price-actions">
                  {editingTicker === ticker ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(ticker)}
                        className="save-btn"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTicker(null)}
                        className="cancel-btn"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditPrice(ticker)}
                        className="edit-btn"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTicker(ticker)}
                        className="delete-btn"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-message">
            No custom prices tracked yet. Add one above to override live prices.
          </p>
        )}
      </div>

      {/* Floating Refresh Button */}
      <div className="fab-container">
        <button
          className="fab-main"
          onClick={fetchLivePrices}
          disabled={loading}
          title="Refresh all live prices"
        >
          {loading ? '⟳' : '🔄'}
        </button>
      </div>
    </div>
  );
};

export default PriceManager;