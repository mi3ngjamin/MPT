import React, { useContext, useState } from "react";
import { Link } from 'react-router-dom';
import AppContext from '../../../context/AppContext';

const BudgetManager = ({ categories, addTransaction }) => {
  const { budgetItems, addBudgetItem, removeBudgetItem, updateBudgetItem } = useContext(AppContext);
  const [category, setCategory] = useState(categories[0] || "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState(1);
  const [editingItem, setEditingItem] = useState(null);
  const [insertMonth, setInsertMonth] = useState("01"); // Default to January
  const [insertYear, setInsertYear] = useState(new Date().getFullYear().toString()); // Default to current year
  const [successMessage, setSuccessMessage] = useState(""); // For success feedback

  const handleAddOrUpdateBudgetItem = () => {
    if (!category || !description || !amount || !day) return;
    const item = {
      id: editingItem ? editingItem.id : Date.now(),
      category,
      description,
      amount: parseFloat(amount),
      day: parseInt(day, 10),
    };
    if (editingItem) {
      updateBudgetItem(item);
    } else {
      addBudgetItem(item);
    }
    resetForm();
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setCategory(item.category);
    setDescription(item.description);
    setAmount(item.amount.toString());
    setDay(item.day);
  };

  const resetForm = () => {
    setCategory(categories[0] || "");
    setDescription("");
    setAmount("");
    setDay(1);
    setEditingItem(null);
  };

  const handleInsertToTracker = () => {
    const newTransactions = budgetItems.map((item) => ({
      date: `${insertYear}-${insertMonth}-${item.day.toString().padStart(2, '0')}`,
      category: item.category,
      description: item.description,
      amount: item.amount.toString(),
    }));
    newTransactions.forEach((transaction) => addTransaction(transaction));
    setSuccessMessage(`Successfully inserted ${newTransactions.length} items to tracker!`);
    setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
  };

  const months = [
    { value: "01", label: "Jan" },
    { value: "02", label: "Feb" },
    { value: "03", label: "Mar" },
    { value: "04", label: "Apr" },
    { value: "05", label: "May" },
    { value: "06", label: "Jun" },
    { value: "07", label: "Jul" },
    { value: "08", label: "Aug" },
    { value: "09", label: "Sep" },
    { value: "10", label: "Oct" },
    { value: "11", label: "Nov" },
    { value: "12", label: "Dec" },
  ];
  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() + i).toString());

  return (
    <div className="category-manager">
      <h1>Manage Monthly Budget</h1>
      <nav className="navbar">
        <Link to="/checkbook" className="nav-button">Back to Transactions</Link>
      </nav>
      <div className="category-input">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
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
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          step="0.01"
        />
        <input
          type="number"
          placeholder="Day of Month"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          min="1"
          max="31"
        />
        <button className="action-button" onClick={handleAddOrUpdateBudgetItem}>
          {editingItem ? 'Save Changes' : 'Add Budget Item'}
        </button>
      </div>
      <div className="insert-controls">
        <label>
          Month:
          <select value={insertMonth} onChange={(e) => setInsertMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <label>
          Year:
          <select value={insertYear} onChange={(e) => setInsertYear(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <button className="action-button" onClick={handleInsertToTracker}>
          Insert to Tracker
        </button>
      </div>
      {successMessage && <p className="success-message">{successMessage}</p>}
      <ul className="category-list">
        {budgetItems.map((item) => (
          <li key={item.id} className="category-item">
            <div className="category-name">
              <span>{item.day}: {item.category} - {item.description} - ${item.amount.toFixed(2)}</span>
            </div>
            <div className="category-actions">
              <button onClick={() => handleEdit(item)} className="edit-button">Edit</button>
              <button onClick={() => removeBudgetItem(item.id)} className="delete-button">Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BudgetManager;