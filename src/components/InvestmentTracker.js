import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useInvestments from '../hooks/useInvestments.js';
import '../css/InvestmentTracker.css';

const InvestmentTracker = () => {
  const { investments } = useInvestments();
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLivePrices = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = 'cvk7391r01qu5brn0jlgcvk7391r01qu5brn0jm0'; // Replace with your Finnhub API key
      const uniqueTickers = [...new Set(investments.map((inv) => inv.ticker))];
      const pricePromises = uniqueTickers.map(async (ticker) => {
        try {
          const response = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`
          );
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          return { ticker, price: data.c || null };
        } catch (err) {
          console.error(`Error fetching price for ${ticker}:`, err);
          return { ticker, price: null };
        }
      });

      const prices = await Promise.all(pricePromises);
      const priceMap = prices.reduce((acc, { ticker, price }) => {
        acc[ticker] = price;
        return acc;
      }, {});
      setLivePrices(priceMap);
    } catch (err) {
      console.error('Error fetching live prices:', err);
      setError('Failed to fetch live prices. Please check your Finnhub API key and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (investments.length > 0) {
      fetchLivePrices();
    }
  }, [investments]);

  const calculatePosition = () => {
    const positions = investments.reduce((acc, inv) => {
      const key = `${inv.account}-${inv.ticker}`;
      if (!acc[key]) {
        acc[key] = { account: inv.account, ticker: inv.ticker, shares: 0, totalCost: 0 };
      }
      const shares = parseFloat(inv.shares);
      const cost = shares * parseFloat(inv.price);
      if (inv.transactionType === 'BUY') {
        acc[key].shares += shares;
        acc[key].totalCost += cost;
      } else if (inv.transactionType === 'SELL') {
        acc[key].shares -= shares;
        acc[key].totalCost -= cost;
      }
      return acc;
    }, {});

    return Object.values(positions).filter((pos) => pos.shares > 0);
  };

  const positions = calculatePosition();

  return (
    <div className="investment-tracker">
      <h2>Investment Positions</h2>
      <div className="action-buttons">
        <button onClick={fetchLivePrices} className="button" disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Live Prices'}
        </button>
        <Link to="/trades" className="view-trades-button">View Trades</Link>
      </div>
      {error && <p className="error-message">{error}</p>}
      {positions.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Ticker</th>
              <th>Shares</th>
              <th>Average Cost</th>
              <th>Current Price</th>
              <th>Market Value</th>
              <th>Unrealized P/L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, index) => {
              const avgCost = pos.totalCost / pos.shares;
              const currentPrice = livePrices[pos.ticker] || 0;
              const marketValue = pos.shares * currentPrice;
              const unrealizedPL = marketValue - pos.totalCost;
              return (
                <tr key={index}>
                  <td>{pos.account}</td>
                  <td>{pos.ticker}</td>
                  <td>{pos.shares.toFixed(2)}</td>
                  <td>${avgCost.toFixed(2)}</td>
                  <td>{currentPrice ? `$${currentPrice.toFixed(2)}` : 'N/A'}</td>
                  <td>{currentPrice ? `$${marketValue.toFixed(2)}` : 'N/A'}</td>
                  <td style={{ color: unrealizedPL >= 0 ? 'green' : 'red' }}>
                    {currentPrice ? `$${unrealizedPL.toFixed(2)}` : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p>No positions to display. Add transactions in the Trades section.</p>
      )}
    </div>
  );
};

export default InvestmentTracker;