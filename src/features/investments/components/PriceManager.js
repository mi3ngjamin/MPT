import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useLivePrices from '../hooks/useLivePrices';
import '../css/PriceManager.css';

const PriceManager = () => {
  const [tickers, setTickers] = useState([]); // Initialize as empty, will update based on livePrices
  const { livePrices, loading, fetchLivePrices, savePrices } = useLivePrices(tickers);
  const [newTicker, setNewTicker] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [editingTicker, setEditingTicker] = useState(null);
  const [editingPrice, setEditingPrice] = useState('');
   const [hasFetched, setHasFetched] = useState(false);

  // Update tickers whenever livePrices changes
  useEffect(() => {
    const currentTickers = Object.keys(livePrices);
    setTickers(currentTickers);
  }, [livePrices]);

  // Fetch prices on mount to ensure we have the latest data
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
    if (window.confirm(`Are you sure you want to delete ${ticker}?`)) {
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
      <div className="header-section">
        <h2>Manage Tracked Prices</h2>
        <nav className="price-nav">
          <button onClick={fetchLivePrices} className="nav-button" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Live Prices'}
          </button>
          <Link to="/investments" className="nav-button">Back to Investments</Link>
        </nav>
      </div>

      <div className="add-ticker-section">
        <h3>Add New Ticker</h3>
        <form onSubmit={handleAddTicker} className="add-ticker-form">
          <div className="form-group">
            <label>Ticker:</label>
            <input
              type="text"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              placeholder="e.g., SWPPX"
              required
            />
          </div>
          <div className="form-group">
            <label>Price:</label>
            <input
              type="number"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="e.g., 100.00"
              required
            />
          </div>
          <button type="submit" className="action-button">Add Ticker</button>
        </form>
      </div>

      <div className="price-list-section">
        <h3>Tracked Tickers</h3>
        {Object.keys(livePrices).length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(livePrices).map(([ticker, price]) => (
                <tr key={ticker}>
                  <td>{ticker}</td>
                  <td>
                    {editingTicker === ticker ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editingPrice}
                        onChange={(e) => setEditingPrice(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      formatCurrency(price)
                    )}
                  </td>
                  <td>
                    {editingTicker === ticker ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(ticker)}
                          className="action-button save-button"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingTicker(null)}
                          className="action-button cancel-button"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditPrice(ticker)}
                          className="action-button edit-button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTicker(ticker)}
                          className="action-button delete-button"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No tickers are currently tracked. Add a ticker above.</p>
        )}
      </div>
    </div>
  );
};

export default PriceManager;