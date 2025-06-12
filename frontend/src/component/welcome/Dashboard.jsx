import React from 'react'
import { useGetUserByIdQuery } from '@/store/api/userSliceApi'
import UserDashboard from './UserDashboard';
export default function Dashboard() {
  const { data: user, isLoading, isError } = useGetUserByIdQuery();
  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error loading user data.</div>;
  return (
    <div>
      
      {user?.role?.name=='user' && <UserDashboard/>}
    </div>
  )
}
