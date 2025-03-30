import React, { createContext, useState, useEffect } from "react";

const BudgetContext = createContext();

export const BudgetProvider = ({ children }) => {
  const [budgetItems, setBudgetItems] = useState(() => {
    const savedBudgets = localStorage.getItem("budgetItems");
    return savedBudgets ? JSON.parse(savedBudgets) : [];
  });

  useEffect(() => {
    localStorage.setItem("budgetItems", JSON.stringify(budgetItems));
  }, [budgetItems]);

  const addBudgetItem = (item) => {
    const updatedItems = [...budgetItems, item].sort((a, b) => a.day - b.day);
    setBudgetItems(updatedItems);
  };

  const removeBudgetItem = (id) => {
    setBudgetItems(budgetItems.filter(item => item.id !== id));
  };

  const updateBudgetItem = (updatedItem) => {
    const updatedItems = budgetItems
      .map(item => item.id === updatedItem.id ? updatedItem : item)
      .sort((a, b) => a.day - b.day);
    setBudgetItems(updatedItems);
  };

  return (
    <BudgetContext.Provider value={{ budgetItems, addBudgetItem, removeBudgetItem, updateBudgetItem }}>
      {children}
    </BudgetContext.Provider>
  );
};

export default BudgetContext;