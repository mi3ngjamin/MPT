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
  };
};

export default useInvestments;