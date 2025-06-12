import { useGetContestsQuery } from '@/store/api/contest'
import React from 'react'
  // Fetch data
  const { data: activeData, isLoading, error: contestError } = useGetContestsQuery()
export default function UserDashboard() {
  return (
    <div>UserDashboard</div>
  )
}
