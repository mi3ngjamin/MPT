import { useState, useEffect } from 'react';

const useInvestments = () => {
  const [investments, setInvestments] = useState(() => {
    const saved = localStorage.getItem('investments');
    let loaded = saved ? JSON.parse(saved) : [];
    // Clean up investments: ensure each item has an account property
    loaded = loaded.map((inv, index) => ({
      ...inv,
      id: inv.id || Date.now() + index, // Ensure each item has an ID
      account: inv.account || 'Unknown', // Default to 'Unknown' if account is missing
    }));
    // Save the cleaned-up data back to localStorage
    localStorage.setItem('investments', JSON.stringify(loaded));
    return loaded;
  });
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterAccount, setFilterAccount] = useState('All');

  useEffect(() => {
    localStorage.setItem('investments', JSON.stringify(investments));
  }, [investments]);

  const addInvestment = (investment) => {
    setInvestments((prev) => [...prev, investment]);
  };

  const importInvestments = (newInvestments) => {
    setInvestments((prev) => [...prev, ...newInvestments]);
  };

  const clearInvestments = () => {
    setInvestments([]);
  };

  const deleteInvestment = (id) => {
    setInvestments((prev) => prev.filter((inv) => inv.id !== id));
  };

  // Sort investments by date
  const sortedInvestments = [...investments].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  // Filter investments by account
  const filteredInvestments = sortedInvestments.filter((inv) => {
    return filterAccount === 'All' || inv.account === filterAccount;
  });

  // Get unique accounts for the filter dropdown
  const accounts = ['All', ...new Set(investments.map((inv) => inv.account || 'Unknown'))];

  // Calculate positions (per account-ticker combo)
  const calculatePositions = () => {
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

  // Aggregate positions by ticker for Total Portfolio
  const aggregatePortfolioPositions = (positions) => {
    const aggregated = positions.reduce((acc, pos) => {
      if (!acc[pos.ticker]) {
        acc[pos.ticker] = { ticker: pos.ticker, shares: 0, totalCost: 0 };
      }
      acc[pos.ticker].shares += pos.shares;
      acc[pos.ticker].totalCost += pos.totalCost;
      return acc;
    }, {});
    return Object.values(aggregated);
  };

  // Calculate totals for an account's positions
  const calculateAccountTotals = (accountPositions, livePrices) => {
    return accountPositions.reduce(
      (acc, pos) => {
        const currentPrice = livePrices[pos.ticker] || 0;
        const marketValue = pos.shares * currentPrice;
        const unrealizedPL = marketValue - pos.totalCost;
        acc.marketValue += marketValue;
        acc.unrealizedPL += unrealizedPL;
        return acc;
      },
      { marketValue: 0, unrealizedPL: 0 }
    );
  };

  return {
    investments,
    sortedInvestments,
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
    calculatePositions,
    aggregatePortfolioPositions,
    calculateAccountTotals,
  };
};

export default useInvestments;