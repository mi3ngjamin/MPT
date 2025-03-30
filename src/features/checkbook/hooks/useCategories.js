import { useState, useEffect } from 'react';

const useCategories = (transactions) => {
  const [categories, setCategories] = useState(() => {
    const savedCategories = JSON.parse(localStorage.getItem('categories')) || [];
    const transactionCategories = [...new Set(transactions.map(t => t.category))];
    return [...new Set([...savedCategories, ...transactionCategories])];
  });

  useEffect(() => {
    localStorage.setItem('categories', JSON.stringify(categories));
  }, [categories]);

  const addCategory = (newCategory) => {
    if (newCategory && !categories.includes(newCategory)) {
      setCategories([...categories, newCategory]);
    }
  };

  const editCategory = (oldCategory, newCategory) => {
    if (newCategory && !categories.includes(newCategory) && newCategory.trim().length > 0) {
      setCategories(categories.map(cat => cat === oldCategory ? newCategory : cat));
      return transactions.map(t => t.category === oldCategory ? { ...t, category: newCategory } : t);
    }
    return transactions;
  };

  const deleteCategory = (categoryToDelete) => {
    if (categories.length > 1 || categoryToDelete !== 'Uncategorized') {
      setCategories(categories.filter(cat => cat !== categoryToDelete));
      return transactions.map(t => t.category === categoryToDelete ? { ...t, category: 'Uncategorized' } : t);
    }
    return transactions;
  };

  return { categories, addCategory, editCategory, deleteCategory };
};

export default useCategories;