import React, { useEffect, useState } from 'react'
import { useGetContestParticipantByIdQuery, useGetLeaderboardQuery, useGetPrizeDistributionsQuery } from '@/store/api/contest'
import { Trophy, TrendingUp, TrendingDown, Users, RefreshCw, Crown, Medal, Award, Star, Zap } from 'lucide-react'

export default function Leaderboard() {
  const userId = 1 // Replace with actual user_id from auth context/store
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  // Manual refresh function
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  // Get contest participant data to find ongoing contest
  const { data: contestParticipant, isLoading: participantLoading, refetch: refetchParticipant } = useGetContestParticipantByIdQuery(userId)
  const ongoingContest = contestParticipant?.find(
    participant => participant.contest?.status === 'ongoing'
  )
  const contestId = ongoingContest?.contest_id

  // Get leaderboard data for the ongoing contest
  const { data: leaderboardData, isLoading: leaderboardLoading, refetch: refetchLeaderboard } = useGetLeaderboardQuery(contestId, {
    skip: !contestId
  })

  // Get prize distributions for the ongoing contest
  const { data: prizeDistributions, isLoading: prizeLoading } = useGetPrizeDistributionsQuery(contestId, { skip: !contestId })

  // Refetch data when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0) {
      refetchParticipant()
      if (contestId) {
        refetchLeaderboard()
      }
    }
  }, [refreshKey, refetchParticipant, refetchLeaderboard, contestId])

  // Helper function to safely format ROI
  const formatROI = (roi) => {
    if (roi === null || roi === undefined || isNaN(roi)) {
      return '0.00'
    }
    return Number(roi).toFixed(2)
  }

  // Helper function to safely format PnL
  const formatPnL = (pnl) => {
    if (pnl === null || pnl === undefined || isNaN(pnl)) {
      return '0'
    }
    return Number(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  }

  if (participantLoading || leaderboardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <span className="text-blue-700 font-semibold text-lg">Loading leaderboard...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!ongoingContest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm">
            <Trophy className="mx-auto h-20 w-20 text-gray-400 mb-6" />
            <h3 className="text-2xl font-bold text-gray-700 mb-3">No Active Contest</h3>
            <p className="text-gray-500 leading-relaxed">There's no ongoing contest at the moment. Check back later!</p>
          </div>
        </div>
      </div>
    )
  }

  if (!leaderboardData || !leaderboardData.leaderboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm">
            <Users className="mx-auto h-20 w-20 text-orange-400 mb-6" />
            <h3 className="text-2xl font-bold text-orange-700 mb-3">No Data Available</h3>
            <p className="text-orange-600 leading-relaxed">Leaderboard data is not available yet.</p>
          </div>
        </div>
      </div>
    )
  }

  // Profit/Loss summary
  const profitCount = leaderboardData.leaderboard.filter(e => (e.totalPnL || 0) > 0).length
  const lossCount = leaderboardData.leaderboard.filter(e => (e.totalPnL || 0) < 0).length
  const breakEvenCount = leaderboardData.leaderboard.filter(e => (e.totalPnL || 0) === 0).length
  const totalParticipants = leaderboardData.leaderboard.length

  // Get rank icon based on position
  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-500" />
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-gray-600 font-bold text-sm">#{rank}</span>
          </div>
        )
    }
  }

  // Get rank styling for mobile cards
  const getRankStyling = (rank) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-xl border-2 border-yellow-300"
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-400 text-white shadow-lg border-2 border-gray-200"
      case 3:
        return "bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-lg border-2 border-amber-300"
      default:
        return "bg-white shadow-md border border-gray-200 hover:shadow-lg"
    }
  }

  return (
    <div className="min-h-screen  mx-2 my-2 bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
              <Trophy className="h-6 w-6 text-yellow-800" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Leaderboard</h1>
              <p className="text-blue-100 text-sm opacity-90">Live Rankings</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
        
        {/* Contest Name */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
          <p className="text-white font-medium text-center">{ongoingContest.contest?.name}</p>
        </div>
      </div>

      {/* Mobile Stats Grid */}
      <div className="px-4 py-6 bg-white/50 backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Total</p>
                <p className="text-2xl font-bold text-gray-900">{totalParticipants}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Profit</p>
                <p className="text-2xl font-bold text-emerald-600">{profitCount}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Loss</p>
                <p className="text-2xl font-bold text-red-500">{lossCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Break Even</p>
                <p className="text-2xl font-bold text-gray-600">{breakEvenCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Leaderboard Cards */}
      <div className="px-4 pb-6 space-y-3">
        {leaderboardData.leaderboard.map((entry, index) => {
          const pnl = entry.totalPnL || 0
          const roi = entry.roi || 0
          
          return (
            <div 
              key={entry.userId} 
              className={`${getRankStyling(entry.rank)} rounded-2xl p-4 transition-all duration-300 active:scale-[0.98]`}
            >
              <div className="flex items-center justify-between">
                {/* Left side - Rank and User */}
                <div className="flex items-center space-x-4">
                  {/* Rank */}
                  <div className="flex-shrink-0">
                    {getRankIcon(entry.rank)}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex items-center space-x-3">
                    {entry.userImg ? (
                      <img 
                        src={entry.userImg} 
                        alt={entry.userName} 
                        className="w-12 h-12 rounded-full border-2 border-white shadow-lg" 
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-lg border-2 border-white">
                        <span className="text-white text-lg font-bold">
                          {entry.userName?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    )}
                    
                    <div>
                      <p className={`font-bold text-lg ${entry.rank <= 3 ? 'text-white' : 'text-gray-900'}`}>
                        {entry.userName}
                      </p>
                      {entry.rank <= 3 && (
                        <div className="flex items-center space-x-1">
                          <Star className="h-3 w-3 text-white/80" />
                          <p className="text-xs text-white/80 font-medium">
                            {entry.rank === 1 ? 'Champion' : entry.rank === 2 ? 'Runner-up' : 'Third Place'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Right side - P&L and ROI */}
                <div className="text-right">
                  <div className="flex items-center space-x-1 justify-end mb-1">
                    <span className={`font-bold text-lg ${
                      pnl > 0 
                        ? entry.rank <= 3 ? 'text-white' : 'text-emerald-600'
                        : pnl < 0 
                          ? entry.rank <= 3 ? 'text-white' : 'text-red-500'
                          : entry.rank <= 3 ? 'text-white' : 'text-gray-500'
                    }`}>
                      ₹{formatPnL(pnl)}
                    </span>
                    {pnl > 0 && <Zap className="h-4 w-4 text-current" />}
                  </div>
                  
                  <div className="flex items-center space-x-1 justify-end">
                    <span className={`font-bold text-sm ${
                      roi > 0 
                        ? entry.rank <= 3 ? 'text-white/90' : 'text-emerald-600'
                        : roi < 0 
                          ? entry.rank <= 3 ? 'text-white/90' : 'text-red-500'
                          : entry.rank <= 3 ? 'text-white/90' : 'text-gray-500'
                    }`}>
                      {roi > 0 ? '+' : ''}{formatROI(roi)}%
                    </span>
                    {roi > 0 ? (
                      <TrendingUp className="h-3 w-3 text-current" />
                    ) : roi < 0 ? (
                      <TrendingDown className="h-3 w-3 text-current" />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Prize Distribution Section */}
      {prizeLoading && prizeDistributions?.length > 0 && 
     
      <div className="px-4 pb-6">
        <h2 className="text-lg font-bold text-blue-700 mb-2">Prize Distribution</h2>
        {prizeLoading ? (
          <div className="text-gray-500 text-sm">Loading prizes...</div>
        ) : prizeDistributions && prizeDistributions.length > 0 ? (
          <ul className="space-y-2">
            {prizeDistributions.map(prize => (
              <li key={prize.id} className="bg-blue-50 rounded-lg p-3 flex items-center justify-between">
                <span className="font-medium text-blue-900">Rank {prize.fromRank}{prize.fromRank !== prize.toRank ? ` - ${prize.toRank}` : ''}</span>
                <span className="font-bold text-green-700">₹{Number(prize.amount).toLocaleString('en-IN')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-gray-500 text-sm">No prize distribution set for this contest.</div>
        )}
      </div>
       }

      {/* Mobile Footer */}
      <div className="bg-white/80 backdrop-blur-sm px-4 py-4 border-t border-gray-200">
        <div className="text-center">
          <p className="text-sm text-gray-600 font-medium mb-1">
            Last updated: {new Date().toLocaleTimeString('en-IN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
          <p className="text-xs text-gray-500">
            Auto-refresh every 30 seconds
          </p>
        </div>
      </div>
    </div>
  )
}