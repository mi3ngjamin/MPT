import React, { useState, useEffect } from 'react';

function TransactionForm({ addTransaction, editingTransaction, editTransaction, categories }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Default to today's date
    category: categories[0] || 'Uncategorized',
    description: '',
    amount: '',
  });

  useEffect(() => {
    if (editingTransaction) {
      setFormData({
        ...editingTransaction,
        date: editingTransaction.date, // Pre-populate with existing date
      });
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0], // Reset to today's date
        category: categories[0] || 'Uncategorized',
        description: '',
        amount: '',
      });
    }
  }, [editingTransaction, categories]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.date || !formData.amount || isNaN(parseFloat(formData.amount))) return;
    if (editingTransaction) {
      editTransaction(formData);
    } else {
      addTransaction(formData);
    }
    setFormData({
      date: new Date().toISOString().split('T')[0], // Reset to today's date
      category: categories[0] || 'Uncategorized',
      description: '', // Clear description after edit
      amount: '', // Clear amount after edit
    });
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <input
        type="date"
        name="date"
        value={formData.date}
        onChange={handleChange}
        required
      />
      <select name="category" value={formData.category} onChange={handleChange}>
        {categories.length > 0 ? (
          categories.map((cat, index) => (
            <option key={index} value={cat}>{cat}</option>
          ))
        ) : (
          <option value="Uncategorized">Uncategorized</option>
        )}
      </select>
      <input
        type="text"
        name="description"
        placeholder="Description"
        value={formData.description}
        onChange={handleChange}
      />
      <input
        type="number"
        name="amount"
        placeholder="Amount"
        value={formData.amount}
        onChange={handleChange}
        step="0.01"
        required
      />
      <button className="transaction-form-button" type="submit">
        {editingTransaction ? 'Save Changes' : 'Add Transaction'}
      </button>
    </form>
  );
}

export default TransactionForm;