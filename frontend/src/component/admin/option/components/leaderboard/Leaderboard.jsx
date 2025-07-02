import React, { useState } from 'react'
import { useGetContestParticipantByIdQuery, useGetLeaderboardQuery } from '@/store/api/contest'

export default function Leaderboard() {
  const userId = 1 // Replace with actual user_id from auth context/store
  const [showMobileView, setShowMobileView] = useState(false)
  
  // Get contest participant data to find ongoing contest
  const { 
    data: contestParticipant, 
    isLoading: participantLoading, 
    error: participantError 
  } = useGetContestParticipantByIdQuery(userId)
  
  // Find ongoing contest ID from participant data
  const ongoingContest = contestParticipant?.find(
    participant => participant.contest?.status === 'ongoing'
  )
  const contestId = ongoingContest?.contest_id
  
  // Get leaderboard data for the ongoing contest
  const { 
    data: leaderboardData, 
    isLoading: leaderboardLoading, 
    isError: leaderboardError, 
    error: leaderboardErrorData 
  } = useGetLeaderboardQuery(contestId, {
    skip: !contestId // Skip query if no contest ID
  })
  
  // Loading states
  if (participantLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  if (leaderboardLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-40 mb-2"></div>
          <div className="h-4 bg-gray-100 rounded w-24 mb-6"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  // Error states
  if (participantError) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-gray-500">{participantError?.data?.error || "Failed to load participant data"}</p>
        </div>
      </div>
    )
  }
  
  if (leaderboardError) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Leaderboard</h3>
          <p className="text-gray-500">{leaderboardErrorData?.data?.error || "Failed to load leaderboard"}</p>
        </div>
      </div>
    )
  }
  
  // No ongoing contest found
  if (!ongoingContest) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Contest</h3>
          <p className="text-gray-500">You're not participating in any ongoing contest.</p>
        </div>
      </div>
    )
  }
  
  // No leaderboard data
  if (!leaderboardData || !leaderboardData.leaderboard || leaderboardData.leaderboard.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
          <p className="text-gray-600">{ongoingContest.contest?.name}</p>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-500">Leaderboard data will appear once trading begins.</p>
        </div>
      </div>
    )
  }
  
  // Helper function to format currency
  const formatCurrency = (value) => {
    return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }
  
  // Helper function to format P&L with color
  const formatPnL = (value) => {
    const numValue = Number(value)
    const colorClass = numValue >= 0 ? 'text-emerald-600' : 'text-red-500'
    const bgClass = numValue >= 0 ? 'bg-emerald-50' : 'bg-red-50'
    const sign = numValue > 0 ? '+' : ''
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass} ${bgClass}`}>
        {sign}₹{Math.abs(numValue).toFixed(0)}
      </span>
    )
  }
  
  // Helper function to format ROI with color
  const formatROI = (value) => {
    const numValue = Number(value)
    const colorClass = numValue >= 0 ? 'text-emerald-600' : 'text-red-500'
    const sign = numValue > 0 ? '+' : ''
    return (
      <span className={`font-medium ${colorClass}`}>
        {sign}{numValue.toFixed(2)}%
      </span>
    )
  }
  
  // Helper function to highlight current user's row
  const isCurrentUser = (entry) => entry.user_id === userId
  
  // Get rank display
  const getRankDisplay = (rank) => {
    if (rank === 1) return { emoji: '🏆', color: 'text-yellow-600', bg: 'bg-yellow-50' }
    if (rank === 2) return { emoji: '🥈', color: 'text-gray-600', bg: 'bg-gray-50' }
    if (rank === 3) return { emoji: '🥉', color: 'text-orange-600', bg: 'bg-orange-50' }
    return { emoji: '', color: 'text-gray-700', bg: 'bg-white' }
  }
  
  // Mobile Card Component
  const MobileCard = ({ entry, index }) => {
    const rankDisplay = getRankDisplay(entry.rank)
    const isUser = isCurrentUser(entry)
    
    return (
      <div className={`p-4 rounded-xl border-2 transition-all ${
        isUser ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${rankDisplay.bg}`}>
              {rankDisplay.emoji || (
                <span className={`text-sm font-bold ${rankDisplay.color}`}>
                  {entry.rank}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                {entry.user?.img ? (
                  <img 
                    src={entry.user.img} 
                    alt={entry.user.username}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {entry.user?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className={`font-medium ${isUser ? 'text-blue-700' : 'text-gray-900'}`}>
                    {entry.user?.username || `User ${entry.user_id}`}
                  </h3>
                  {isUser && (
                    <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="text-right">
           
            <div className="text-sm">
              {formatROI(entry.roi)}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
        
          <div>
            <div className="text-gray-500 text-xs">Realized P&L</div>
            <div className="mt-1">{formatPnL(entry.realized_pnl)}</div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
            <p className="text-gray-600 mt-1">{ongoingContest.contest?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                ongoingContest.contest?.status === 'ongoing' ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
              <span className="text-sm text-gray-600 capitalize font-medium">
                {ongoingContest.contest?.status}
              </span>
            </div>
            {/* View Toggle for mobile */}
            <div className="sm:hidden">
              <button
                onClick={() => setShowMobileView(!showMobileView)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile View */}
      <div className="sm:hidden p-4 space-y-3">
        {leaderboardData.leaderboard.map((entry, index) => (
          <MobileCard key={entry.id} entry={entry} index={index} />
        ))}
      </div>
      
      {/* Desktop View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left py-4 px-6 font-semibold text-gray-700">Rank</th>
              <th className="text-left py-4 px-6 font-semibold text-gray-700">User</th>
              <th className="text-right py-4 px-6 font-semibold text-gray-700">Portfolio</th>
              <th className="text-right py-4 px-6 font-semibold text-gray-700">Total P&L</th>
              <th className="text-right py-4 px-6 font-semibold text-gray-700">Realized P&L</th>
              <th className="text-right py-4 px-6 font-semibold text-gray-700">ROI</th>
            </tr>
          </thead>
          <tbody>
            {leaderboardData.leaderboard.map((entry, index) => {
              const rankDisplay = getRankDisplay(entry.rank)
              const isUser = isCurrentUser(entry)
              
              return (
                <tr 
                  key={entry.id} 
                  className={`border-b border-gray-50 hover:bg-gray-25 transition-colors ${
                    isUser ? 'bg-blue-50 hover:bg-blue-100' : ''
                  }`}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${rankDisplay.bg}`}>
                        {rankDisplay.emoji || (
                          <span className={`text-sm font-bold ${rankDisplay.color}`}>
                            {entry.rank}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {entry.user?.img ? (
                        <img 
                          src={entry.user.img} 
                          alt={entry.user.username}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <span className="text-white font-medium">
                            {entry.user?.username?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className={`font-medium ${isUser ? 'text-blue-700' : 'text-gray-900'}`}>
                          {entry.user?.username || `User ${entry.user_id}`}
                        </div>
                        {isUser && (
                          <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                
                  <td className="py-4 px-6 text-right">
                    {formatPnL(entry.total_pnl)}
                  </td>
                  <td className="py-4 px-6 text-right">
                    {formatPnL(entry.realized_pnl)}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="font-semibold">
                      {formatROI(entry.roi)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm text-gray-500">
          <div>
            Last updated: {new Date(leaderboardData.snapshot_time).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {leaderboardData.leaderboard.length} participants
          </div>
        </div>
      </div>
    </div>
  )
}