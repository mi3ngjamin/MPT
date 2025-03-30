import React from 'react';

function TransactionList({ transactions, deleteTransaction, editTransaction, archiveTransaction, calculateBalance }) {
  return (
    <div className="transaction-list">
      <h3>Transactions</h3>
      {transactions.length === 0 ? (
        <p>No transactions to display.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => (
              <tr
                key={transaction.id}
                className={transaction.isArchived ? 'archived' : index % 2 === 0 ? 'even' : 'odd'}
              >
                <td>{transaction.date}</td>
                <td>{transaction.category}</td>
                <td>{transaction.description}</td>
                <td style={{ color: transaction.type === 'income' ? 'green' : 'red' }}>
                  ${parseFloat(transaction.amount).toFixed(2)}
                </td>
                <td>${calculateBalance(transaction)}</td>
                <td>
                  {transaction.isArchived ? (
                    <span className="archived-label">Archived</span>
                  ) : (
                    <>
                      <button
                        onClick={() => editTransaction(transaction)}
                        className="edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTransaction(transaction.id)}
                        className="delete-button"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => archiveTransaction(transaction.id)}
                        className="archive-button"
                      >
                        Archive
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TransactionList;