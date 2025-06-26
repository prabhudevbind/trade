import React from 'react'
import { useGetUserByIdQuery } from '@/store/api/userSliceApi'
import UserDashboard from './UserDashboard';
import Loader from '../admin/option/Loader';
import OptionChain from '../admin/option/OptionChart';
import AdminDashboard from './AdminDashboard';
export default function Dashboard() {
  const { data: user, isLoading, isError } = useGetUserByIdQuery();
  if (isLoading) return <Loader/>;
  if (isError) return <div>Error loading user data.</div>;
  return (
    <div>
  
      {user?.role?.name=='user' && <OptionChain/>}
      {user?.role?.name=='admin' && <AdminDashboard/>}
    </div>
  )
}
