// ProtectedRoute.js
import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children, requiredPermissions }) => {
  const [loading, setLoading] = useState(true);
  const permissions = useSelector(state => state.auth.user?.role.permissions || []);

  useEffect(() => {
    // Simulate an API call to fetch permissions
    const fetchPermissions = async () => {
      // Simulate a delay for fetching permissions
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
    };

    fetchPermissions();
  }, []);

  // Check if user has the required permissions
  const hasPermission = requiredPermissions.some(permission =>
    permissions.some(userPermission => 
      userPermission.permission?.name?.toLowerCase() === permission.toLowerCase()
    )
  );

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="spinner"></div></div>; // Use the spinner class
  }

  return hasPermission ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;