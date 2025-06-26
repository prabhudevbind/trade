import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function Enci() {
  const [accessToken, setAccessToken] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Fetch current ACCESS_TOKEN on mount
  useEffect(() => {
    setLoading(true);
    axios.get('http://localhost:5001/api/v1/env?key=ACCESS_TOKEN')
      .then(res => {
        setAccessToken(res.data.value || '');
        setInputValue(res.data.value || '');
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch ACCESS_TOKEN');
        setLoading(false);
      });
  }, []);

  // Handle update
  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await axios.post('http://localhost:5001/api/v1/env', {
        key: 'ACCESS_TOKEN',
        value: inputValue
      }, {
        headers: {
          // Add your auth token if needed
        }
      });
      setMessage('ACCESS_TOKEN updated successfully!');
      setAccessToken(inputValue);
    } catch (err) {
      setError('Failed to update ACCESS_TOKEN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">ACCESS_TOKEN Management</h2>
      {loading && <div className="mb-2 text-blue-600">Loading...</div>}
      {error && <div className="mb-2 text-red-600">{error}</div>}
      {message && <div className="mb-2 text-green-600">{message}</div>}
      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Current ACCESS_TOKEN:</label>
          <input
            type="text"
            className="w-full border rounded px-2 py-1 bg-gray-100"
            value={accessToken}
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New ACCESS_TOKEN:</label>
          <input
            type="text"
            className="w-full border rounded px-2 py-1"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          Update ACCESS_TOKEN
        </button>
      </form>
    </div>
  );
}
