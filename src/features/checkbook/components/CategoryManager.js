import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function CategoryManager({ categories, addCategory, editCategory, deleteCategory }) {
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      addCategory(newCategory.trim());
      setNewCategory('');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setEditValue(category);
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== editingCategory && !categories.includes(editValue.trim())) {
      editCategory(editingCategory, editValue.trim());
      setEditingCategory(null);
      setEditValue('');
    }
  };

  const handleDelete = (category) => {
    if (categories.length > 1 || category !== 'Uncategorized') {
      deleteCategory(category);
    }
  };

  return (
    <div className="category-manager">
      <h1>Manage Categories</h1>
      <nav className="navbar">
        <Link to="/checkbook" className="nav-button">Back to Transactions</Link>
      </nav>
      <div className="category-input">
        <input
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="Enter new category"
        />
        <button className="action-button" onClick={handleAdd}>Add Category</button>
      </div>
      <ul className="category-list">
        {categories.map((cat, index) => (
          <li key={index} className="category-item">
            <div className="category-name">
              {editingCategory === cat ? (
                <div>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSaveEdit}
                    autoFocus
                  />
                </div>
              ) : (
                <span>{cat}</span>
              )}
            </div>
            <div className="category-actions">
              {editingCategory === cat ? (
                <button className="edit-button" onClick={handleSaveEdit}>Save</button>
              ) : (
                <button className="edit-button" onClick={() => handleEdit(cat)}>Edit</button>
              )}
              <button className="delete-button" onClick={() => handleDelete(cat)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CategoryManager;