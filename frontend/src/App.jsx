// React and built-in libraries
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';


// Third-party libraries
import Cookies from 'js-cookie';

// Internal modules
import { useGetUserRefetchQuery } from './store/api/apiSlice';

import { clearAllDetails, setToken } from './store/reducer/authSlice';
import { createAppRouter } from './router/AppRouter';
import './App.css';
// React and built-in libraries

// Third-party libraries

// Internal modules

// Styles

export default function App() {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [serverError, setServerError] = useState(null);

  const dispatch = useDispatch();
  const { data: userData, isLoading, error } = useGetUserRefetchQuery(undefined, {
    // Add error handling for the query
    onError: (err) => {
      if (err.status === 500) {
        setServerError('Server error occurred. Please try again later.');
      }
    }
  });
  
  const { isAuthenticated } = useSelector((state) => state.auth);
  

  // Handle authentication state
  useEffect(() => {
    if (error) {
      if (error.status === 401) {
        dispatch(clearAllDetails());
        Cookies.remove('token');
      } else if (error.status === 500) {
        setServerError('Server error occurred. Please try again later.');
      }
    } else if (userData) {
      dispatch(setToken(userData));
      setServerError(null); // Clear any previous errors on successful load
    }
  }, [userData, error, dispatch]);


  // Cache busting with version check
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch(`/api/version?t=${new Date().getTime()}`);
        if (!response.ok) {
          if (response.status === 500) {
            setServerError('Server error while checking app version.');
            return;
          }
        }
        
        const { version } = await response.json();
        const storedVersion = localStorage.getItem('appVersion');

        if (storedVersion && storedVersion !== version) {
          // Clear browser cache and reload
          if ('caches' in window) {
            caches.keys().then((names) => {
              names.forEach((name) => caches.delete(name));
            });
          }
          localStorage.setItem('appVersion', version);
          window.location.reload(true); // Force reload from server
        } else if (!storedVersion) {
          localStorage.setItem('appVersion', version);
        }
      } catch (err) {
        console.error('Failed to check app version:', err);
        setServerError('Failed to check app version. Please refresh the page.');
      }
    };

    checkVersion();
  }, []);

  // Function to retry after server error
  const retryAfterError = () => {
    setServerError(null);
    window.location.reload();
  };



  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
      </div>
    );
  }

  const router = createAppRouter(isAuthenticated);
  return <RouterProvider router={router} />;
}