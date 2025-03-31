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
  const [hasFetched, setHasFetched] = useState(false);
  const [visibleColumnsBeforeMarketValue, setVisibleColumnsBeforeMarketValue] = useState(4); // Default for desktop

  // Detect screen size and adjust colSpan
  useEffect(() => {
    const updateVisibleColumns = () => {
      const isTablet = window.matchMedia('(max-width: 1024px)').matches;
      const isMobile = window.matchMedia('(max-width: 768px)').matches;

      if (isMobile) {
        // Mobile: Ticker, Shares (2 columns before Market Value)
        setVisibleColumnsBeforeMarketValue(2);
      } else if (isTablet) {
        // Tablet: Ticker, Shares, Current Price (3 columns before Market Value)
        setVisibleColumnsBeforeMarketValue(3);
      } else {
        // Desktop: Ticker, Shares, Avg Cost, Current Price (4 columns before Market Value)
        setVisibleColumnsBeforeMarketValue(4);
      }
    };

    // Initial check
    updateVisibleColumns();

    // Add resize listener
    window.addEventListener('resize', updateVisibleColumns);
    return () => window.removeEventListener('resize', updateVisibleColumns);
  }, []);

  useEffect(() => {
    if (investments.length > 0 && !hasFetched) {
      fetchLivePrices();
      setHasFetched(true);
    }
  }, [investments.length, hasFetched, fetchLivePrices]);

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

  const renderTable = (positions, account) => {
    const sortedPositions = sortPositions(positions, account);
    const totals = calculateAccountTotals(positions, livePrices);

    return (
      <table>
        <thead>
          <tr>
            <th className="col-ticker" onClick={() => handleSort(account, 'ticker')}>
              Ticker{getSortIndicator(account, 'ticker')}
            </th>
            <th className="col-shares" onClick={() => handleSort(account, 'shares')}>
              Shares{getSortIndicator(account, 'shares')}
            </th>
            <th className="col-avg-cost" onClick={() => handleSort(account, 'avgCost')}>
              Average Cost{getSortIndicator(account, 'avgCost')}
            </th>
            <th className="col-current-price" onClick={() => handleSort(account, 'currentPrice')}>
              Current Price{getSortIndicator(account, 'currentPrice')}
            </th>
            <th className="col-market-value" onClick={() => handleSort(account, 'marketValue')}>
              Market Value{getSortIndicator(account, 'marketValue')}
            </th>
            <th className="col-portfolio-percentage" onClick={() => handleSort(account, 'portfolioPercentage')}>
              % of Portfolio{getSortIndicator(account, 'portfolioPercentage')}
            </th>
            <th className="col-unrealized-pl" onClick={() => handleSort(account, 'unrealizedPL')}>
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
                <td className="col-ticker">{pos.ticker}</td>
                <td className="col-shares">{pos.shares.toFixed(2)}</td>
                <td className="col-avg-cost">{formatCurrency(avgCost)}</td>
                <td className="col-current-price">{currentPrice ? formatCurrency(currentPrice) : 'N/A'}</td>
                <td className="col-market-value">{currentPrice ? formatCurrency(marketValue) : 'N/A'}</td>
                <td className="col-portfolio-percentage">{portfolioPercentage.toFixed(2)}%</td>
                <td className="col-unrealized-pl" style={{ color: unrealizedPL >= 0 ? 'green' : 'red' }}>
                  {currentPrice ? formatCurrency(unrealizedPL) : 'N/A'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td className="col-ticker" colSpan={visibleColumnsBeforeMarketValue}>Total</td>
            <td className="col-market-value">{formatCurrency(totals.marketValue)}</td>
            <td className="col-portfolio-percentage"></td>
            <td className="col-unrealized-pl" style={{ color: totals.unrealizedPL >= 0 ? 'green' : 'red' }}>
              {formatCurrency(totals.unrealizedPL)}
            </td>
          </tr>
        </tfoot>
      </table>
    );
  };

  return (
    <div className="investment-tracker">
      <div className="header-section">
        <div className="action-buttons">
          <button onClick={fetchLivePrices} className="button" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Live Prices'}
          </button>
          <Link to="/trades" className="view-trades-button">View Trades</Link>
        </div>
      </div>
      {error && <p className="error-message">{error}</p>}
      {positions.length > 0 ? (
        <>
          {Object.entries(positionsByAccount).map(([account, accountPositions]) => (
            <div key={account} className="account-section">
              <h3>{account}</h3>
              {renderTable(accountPositions, account)}
            </div>
          ))}
          <div className="summary-section">
            <h3>Total Portfolio</h3>
            {renderTable(portfolioPositions, 'portfolio')}
          </div>
        </>
      ) : (
        <p>No positions to display. Add transactions in the Trades section.</p>
      )}
    </div>
  );
};

export default InvestmentTracker;