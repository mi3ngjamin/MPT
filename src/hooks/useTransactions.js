import { useState, useEffect } from 'react';
import Papa from 'papaparse';

const useTransactions = () => {
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('transactions');
    let loaded = saved ? JSON.parse(saved) : [];
    return loaded.map((t, index) => ({
      ...t,
      id: t.id || Date.now() + index,
      isArchived: t.isArchived || false,
    }));
  });
  const [startingBalance, setStartingBalance] = useState(() => {
    return parseFloat(localStorage.getItem('startingBalance')) || 0;
  });
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [editingTransaction, setEditingTransaction] = useState(null);

  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const totalBalance = sortedTransactions.reduce((acc, t) => {
    const amount = parseFloat(t.amount);
    return t.type === 'income' ? acc + amount : acc - amount;
  }, startingBalance);

  const filteredTransactions = sortedTransactions.filter((t) => {
    const date = new Date(t.date);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();
    return (
      (!filterMonth || month === filterMonth) &&
      (filterYear === 'All' || year === filterYear) &&
      (filterCategory === 'All' || t.category === filterCategory)
    );
  });

  const months = [
    'All Months',
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const years = ['All', ...new Set(sortedTransactions.map((t) => new Date(t.date).getFullYear().toString()))];

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('startingBalance', startingBalance.toString());
  }, [transactions, startingBalance]);

  const addTransaction = (transaction) => {
    const amount = parseFloat(transaction.amount);
    const type = amount >= 0 ? 'income' : 'expense';
    const newTransaction = {
      ...transaction,
      id: Date.now() + Math.random(),
      amount: Math.abs(amount).toString(),
      type,
      isArchived: false,
    };
    setTransactions((prev) => [...prev, newTransaction]);
  };

  const handleEditTransaction = (transaction) => {
    if (!transaction.isArchived) {
      setEditingTransaction(transaction);
    }
  };

  const saveEditTransaction = (updatedTransaction) => {
    if (!updatedTransaction.isArchived) {
      const amount = parseFloat(updatedTransaction.amount);
      const type = amount >= 0 ? 'income' : 'expense';
      const newTransaction = {
        ...updatedTransaction,
        amount: Math.abs(amount).toString(),
        type,
        id: updatedTransaction.id,
      };
      setTransactions(
        transactions.map((t) => (t.id === newTransaction.id ? newTransaction : t))
      );
      setEditingTransaction(null);
    }
  };

  const deleteTransaction = (transactionId) => {
    setTransactions(
      transactions.filter((t) => t.id !== transactionId && !t.isArchived)
    );
  };

  const clearTransactions = () => {
    setTransactions([]);
    setStartingBalance(0);
    setFilterMonth('');
    setFilterYear('All');
    setFilterCategory('All');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      complete: (result) => {
        const data = result.data;
        let newStartingBalance = 0;
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
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  const handleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const archiveTransaction = (transactionId) => {
    setTransactions(
      transactions.map((t) =>
        t.id === transactionId ? { ...t, isArchived: true } : t
      )
    );
  };

  const calculateRunningBalance = (transaction) => {
    const index = sortedTransactions.findIndex((t) => t.id === transaction.id);
    return sortedTransactions
      .slice(0, index + 1)
      .reduce((acc, t) => {
        const amount = parseFloat(t.amount);
        return t.type === 'income' ? acc + amount : acc - amount;
      }, startingBalance)
      .toFixed(2);
  };

  return {
    transactions,
    setTransactions, // Expose setTransactions
    startingBalance,
    setStartingBalance, // Expose setStartingBalance
    sortOrder,
    filterMonth,
    setFilterMonth,
    filterYear,
    setFilterYear,
    filterCategory,
    setFilterCategory,
    editingTransaction,
    sortedTransactions,
    totalBalance,
    filteredTransactions,
    months,
    years,
    addTransaction,
    handleEditTransaction,
    saveEditTransaction,
    deleteTransaction,
    clearTransactions,
    handleFileUpload,
    handleSort,
    archiveTransaction,
    calculateRunningBalance,
  };
};

export default useTransactions;