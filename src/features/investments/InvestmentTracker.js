import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useInvestments from './hooks/useInvestments';
import useLivePrices from './hooks/useLivePrices';
import './css/InvestmentTracker.css';

const InvestmentTracker = () => {
  const { investments, calculatePositions, aggregatePortfolioPositions, calculateAccountTotals } = useInvestments();
  const tickers = investments.map((inv) => inv.ticker);
  const { livePrices, loading, error, fetchLivePrices } = useLivePrices(tickers);
  const [sortConfig, setSortConfig] = useState({});
  const [hasFetched, setHasFetched] = useState(false); // Track initial fetch

  // Fetch prices on initial load only if investments exist and we haven’t fetched yet
  useEffect(() => {
    if (investments.length > 0 && !hasFetched) {
      fetchLivePrices();
      setHasFetched(true); // Prevent subsequent fetches on re-render
    }
  }, [investments.length, hasFetched, fetchLivePrices]); // Depend on length, not investments object

  const positions = calculatePositions();
  const portfolioPositions = aggregatePortfolioPositions(positions);

  const positionsByAccount = positions.reduce((acc, pos) => {
    if (!acc[pos.account]) acc[pos.account] = [];
    acc[pos.account].push(pos);
    return acc;
  }, {});

  const totalMarketValue = portfolioPositions.reduce((sum, pos) => {
    const currentPrice = livePrices[pos.ticker] || 0;
    return sum + pos.shares * currentPrice;
  }, 0);

  const sortPositions = (positions, account) => {
    const { key, direction } = sortConfig[account] || {};
    if (!key) return positions;

    return [...positions].sort((a, b) => {
      let aValue, bValue;
      switch (key) {
        case 'ticker':
          aValue = a.ticker;
          bValue = b.ticker;
          return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        case 'shares':
          aValue = a.shares;
          bValue = b.shares;
          break;
        case 'avgCost':
          aValue = a.totalCost / a.shares;
          bValue = b.totalCost / b.shares;
          break;
        case 'currentPrice':
          aValue = livePrices[a.ticker] || 0;
          bValue = livePrices[b.ticker] || 0;
          break;
        case 'marketValue':
          aValue = (livePrices[a.ticker] || 0) * a.shares;
          bValue = (livePrices[b.ticker] || 0) * b.shares;
          break;
        case 'portfolioPercentage':
          aValue = totalMarketValue > 0 ? (((livePrices[a.ticker] || 0) * a.shares) / totalMarketValue) * 100 : 0;
          bValue = totalMarketValue > 0 ? (((livePrices[b.ticker] || 0) * b.shares) / totalMarketValue) * 100 : 0;
          break;
        case 'unrealizedPL':
          aValue = (livePrices[a.ticker] || 0) * a.shares - a.totalCost;
          bValue = (livePrices[b.ticker] || 0) * b.shares - b.totalCost;
          break;
        default:
          return 0;
      }
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  const handleSort = (account, key) => {
    setSortConfig((prev) => {
      const current = prev[account] || { key: '', direction: 'asc' };
      const newDirection = current.key === key && current.direction === 'asc' ? 'desc' : 'asc';
      return { ...prev, [account]: { key, direction: newDirection } };
    });
  };

  const getSortIndicator = (account, column) => {
    const { key, direction } = sortConfig[account] || {};
    if (key === column) return direction === 'asc' ? ' ↑' : ' ↓';
    return '';
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
    <div className="investment-tracker">
      <div className="header-section">
        <div className="action-buttons">
          <button onClick={fetchLivePrices} className="button" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Live Prices'}
          </button>
          <Link to="/trades" className="button view-trades-button">View Trades</Link>
        </div>
      </div>
      {error && <p className="error-message">{error}</p>}
      {positions.length > 0 ? (
        <>
          {Object.entries(positionsByAccount).map(([account, accountPositions]) => {
            const accountTotals = calculateAccountTotals(accountPositions, livePrices);
            const sortedPositions = sortPositions(accountPositions, account);
            return (
              <div key={account} className="account-section">
                <h3>{account}</h3>
                <table>
                  <thead>
                    <tr>
                      <th onClick={() => handleSort(account, 'ticker')}>
                        Ticker{getSortIndicator(account, 'ticker')}
                      </th>
                      <th onClick={() => handleSort(account, 'shares')}>
                        Shares{getSortIndicator(account, 'shares')}
                      </th>
                      <th onClick={() => handleSort(account, 'avgCost')}>
                        Average Cost{getSortIndicator(account, 'avgCost')}
                      </th>
                      <th onClick={() => handleSort(account, 'currentPrice')}>
                        Current Price{getSortIndicator(account, 'currentPrice')}
                      </th>
                      <th onClick={() => handleSort(account, 'marketValue')}>
                        Market Value{getSortIndicator(account, 'marketValue')}
                      </th>
                      <th onClick={() => handleSort(account, 'portfolioPercentage')}>
                        % of Portfolio{getSortIndicator(account, 'portfolioPercentage')}
                      </th>
                      <th onClick={() => handleSort(account, 'unrealizedPL')}>
                        Unrealized P/L{getSortIndicator(account, 'unrealizedPL')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPositions.map((pos, index) => {
                      const avgCost = pos.totalCost / pos.shares;
                      const currentPrice = livePrices[pos.ticker] || 0;
                      const marketValue = pos.shares * currentPrice;
                      const portfolioPercentage =
                        totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : 0;
                      const unrealizedPL = marketValue - pos.totalCost;
                      return (
                        <tr key={index}>
                          <td>{pos.ticker}</td>
                          <td>{pos.shares.toFixed(2)}</td>
                          <td>{formatCurrency(avgCost)}</td>
                          <td>{currentPrice ? formatCurrency(currentPrice) : 'N/A'}</td>
                          <td>{currentPrice ? formatCurrency(marketValue) : 'N/A'}</td>
                          <td>{portfolioPercentage.toFixed(2)}%</td>
                          <td style={{ color: unrealizedPL >= 0 ? 'green' : 'red' }}>
                            {currentPrice ? formatCurrency(unrealizedPL) : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan="4">Total</td>
                      <td>{formatCurrency(accountTotals.marketValue)}</td>
                      <td></td>
                      <td style={{ color: accountTotals.unrealizedPL >= 0 ? 'green' : 'red' }}>
                        {formatCurrency(accountTotals.unrealizedPL)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
          <div className="summary-section">
            <h3>Total Portfolio</h3>
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('portfolio', 'ticker')}>
                    Ticker{getSortIndicator('portfolio', 'ticker')}
                  </th>
                  <th onClick={() => handleSort('portfolio', 'shares')}>
                    Shares{getSortIndicator('portfolio', 'shares')}
                  </th>
                  <th onClick={() => handleSort('portfolio', 'avgCost')}>
                    Average Cost{getSortIndicator('portfolio', 'avgCost')}
                  </th>
                  <th onClick={() => handleSort('portfolio', 'currentPrice')}>
                    Current Price{getSortIndicator('portfolio', 'currentPrice')}
                  </th>
                  <th onClick={() => handleSort('portfolio', 'marketValue')}>
                    Market Value{getSortIndicator('portfolio', 'marketValue')}
                  </th>
                  <th onClick={() => handleSort('portfolio', 'portfolioPercentage')}>
                    % of Portfolio{getSortIndicator('portfolio', 'portfolioPercentage')}
                  </th>
                  <th onClick={() => handleSort('portfolio', 'unrealizedPL')}>
                    Unrealized P/L{getSortIndicator('portfolio', 'unrealizedPL')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortPositions(portfolioPositions, 'portfolio').map((pos, index) => {
                  const avgCost = pos.totalCost / pos.shares;
                  const currentPrice = livePrices[pos.ticker] || 0;
                  const marketValue = pos.shares * currentPrice;
                  const portfolioPercentage =
                    totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : 0;
                  const unrealizedPL = marketValue - pos.totalCost;
                  return (
                    <tr key={index}>
                      <td>{pos.ticker}</td>
                      <td>{pos.shares.toFixed(2)}</td>
                      <td>{formatCurrency(avgCost)}</td>
                      <td>{currentPrice ? formatCurrency(currentPrice) : 'N/A'}</td>
                      <td>{currentPrice ? formatCurrency(marketValue) : 'N/A'}</td>
                      <td>{portfolioPercentage.toFixed(2)}%</td>
                      <td style={{ color: unrealizedPL >= 0 ? 'green' : 'red' }}>
                        {currentPrice ? formatCurrency(unrealizedPL) : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan="4">Total</td>
                  <td>{formatCurrency(totalMarketValue)}</td>
                  <td></td>
                  <td style={{ color: portfolioPositions.reduce((sum, pos) => sum + ((livePrices[pos.ticker] || 0) * pos.shares - pos.totalCost), 0) >= 0 ? 'green' : 'red' }}>
                    {formatCurrency(portfolioPositions.reduce((sum, pos) => sum + ((livePrices[pos.ticker] || 0) * pos.shares - pos.totalCost), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <p>No positions to display. Add transactions in the Trades section.</p>
      )}
    </div>
  );
};

export default InvestmentTracker;