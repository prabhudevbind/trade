"use client"

import { useEffect, useState } from "react"
import {
  useGetContestParticipantByIdQuery,
  useGetLeaderboardQuery,
  useGetPrizeDistributionsQuery,
} from "@/store/api/contest"
import { Trophy, TrendingUp, TrendingDown, Users, RefreshCw, Crown, Medal, Award, Star, User, Gift } from "lucide-react"
import { useGetUserByIdQuery } from "@/store/api/userSliceApi"
import { useGetWinningHistoryQuery } from "@/store/api/win.api"

export default function Leaderboard() {
  const userId = 1 // Replace with actual user_id from auth context/store
  const [refreshKey, setRefreshKey] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showWinners, setShowWinners] = useState(false)
  const [activeTab, setActiveTab] = useState("leaderboard") // New state for active tab

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().slice(0, 10)
  const { data: winningData, isLoading: winningHistoryLoading } = useGetWinningHistoryQuery({ startDate: today, endDate: today })
  const { data: userData, isLoading: userLoading } = useGetUserByIdQuery(userId)

  // Check if current time is after 3:30 PM India time
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setCurrentTime(now)
      
      // India time is UTC+5:30, so we need to check if it's 10:00 UTC (3:30 PM IST)
      const indiaTime = new Date(now.getTime() + (0 * 60 * 60 * 1000))
      const isAfter330PM = indiaTime.getHours() > 15 || (indiaTime.getHours() === 15 && indiaTime.getMinutes() >= 30)
      
      setShowWinners(isAfter330PM)
    }, 1000) // Update every second to be precise

    return () => clearInterval(interval)
  }, [])

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Manual refresh function
  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  // Get contest participant data to find ongoing contest
  const {
    data: contestParticipant,
    isLoading: participantLoading,
    refetch: refetchParticipant,
  } = useGetContestParticipantByIdQuery(userId)

  const ongoingContest = contestParticipant?.find((participant) => participant.contest?.status === "ongoing")
  const contestId = ongoingContest?.contest_id

  // Get leaderboard data for the ongoing contest
  const {
    data: leaderboardData,
    isLoading: leaderboardLoading,
    refetch: refetchLeaderboard,
  } = useGetLeaderboardQuery(contestId, {
    skip: !contestId,
  })

  // Get prize distributions for the ongoing contest
  const { data: prizeDistributions, isLoading: prizeLoading } = useGetPrizeDistributionsQuery(contestId, {
    skip: !contestId,
  })

  // Refetch data when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0) {
      refetchParticipant()
      if (contestId) {
        refetchLeaderboard()
      }
    }
  }, [refreshKey, refetchParticipant, refetchLeaderboard, contestId])

  // Check if winning data is available (must be non-empty array)
  const hasWinningData =
    winningData &&
    ((Array.isArray(winningData.data) && winningData.data.length > 0) ||
    (Array.isArray(winningData) && winningData.length > 0)
)

  // Helper functions
  const formatROI = (roi) => {
    if (roi === null || roi === undefined || isNaN(roi)) {
      return "0.00"
    }
    return Number(roi).toFixed(2)
  }

  const formatPnL = (pnl) => {
    if (pnl === null || pnl === undefined || isNaN(pnl)) {
      return "0"
    }
    return Number(pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })
  }

  const getUserAvatar = (user) => {
    if (user?.img) {
      return (
        <img
          src={user.img || "/placeholder.svg"}
          alt={user.username}
          className="w-full h-full rounded-full object-cover"
        />
      )
    }
    return (
      <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <span className="text-white font-bold text-lg">{user?.username?.charAt(0)?.toUpperCase() || "U"}</span>
      </div>
    )
  }

  const getPodiumHeight = (rank) => {
    switch (rank) {
      case 1:
        return "h-32"
      case 2:
        return "h-24"
      case 3:
        return "h-20"
      default:
        return "h-16"
    }
  }

  const getPodiumColor = (rank) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-t from-yellow-400 to-yellow-300"
      case 2:
        return "bg-gradient-to-t from-gray-400 to-gray-300"
      case 3:
        return "bg-gradient-to-t from-amber-500 to-amber-400"
      default:
        return "bg-gray-200"
    }
  }

  // Format time display for India timezone
  const formatIndiaTime = (date) => {
    return new Date(date.getTime() + (0 * 60 * 60 * 1000)).toLocaleTimeString("en-IN", {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    })
  }

  // --- Data mapping for leaderboard and winners ---
  // Map leaderboard data
  const mappedLeaderboard = (Array.isArray(leaderboardData?.leaderboard) ? leaderboardData.leaderboard : []).map((entry) => ({
    ...entry,
    totalPnL: Number(entry.total_pnl),
    unrealizedPnL: Number(entry.unrealized_pnl),
    realizedPnL: Number(entry.realized_pnl),
    roi: Number(entry.roi),
    userName: entry.user?.username,
    userImg: entry.user?.img,
    userId: entry.user_id, // normalize to userId
    user: entry.user,
    rank: entry.rank,
  }))
  const leaderboard_totalParticipants = mappedLeaderboard.length
  const leaderboard_profitCount = mappedLeaderboard.filter(w => Number(w.totalPnL) > 0).length
  const leaderboard_lossCount = mappedLeaderboard.filter(w => Number(w.totalPnL) < 0).length
  const leaderboard_breakEvenCount = mappedLeaderboard.filter(w => Number(w.totalPnL) === 0).length
  const leaderboard_topWinners = mappedLeaderboard.slice(0, 3)
  const leaderboard_remainingWinners = mappedLeaderboard.slice(3)
  const leaderboard_currentUserWin = mappedLeaderboard.find((entry) => entry.userId === userData.id)

  // Map winners data
  const mappedWinners = (Array.isArray(winningData?.data) ? winningData.data : []).map((entry) => ({
    ...entry,
    totalPnL: Number(entry.leaderboard?.total_pnl),
    unrealizedPnL: Number(entry.leaderboard?.unrealized_pnl),
    realizedPnL: Number(entry.leaderboard?.realized_pnl),
    roi: Number(entry.leaderboard?.roi),
    userName: entry.user?.username,
    userImg: entry.user?.img,
    userId: entry.userId, // normalize to userId
    user: entry.user,
    amount: Number(entry.amount),
    rank: entry.rank,
  }))
  const winners_totalParticipants = mappedWinners.length
  const winners_profitCount = mappedWinners.filter(w => Number(w.totalPnL) > 0).length
  const winners_lossCount = mappedWinners.filter(w => Number(w.totalPnL) < 0).length
  const winners_breakEvenCount = mappedWinners.filter(w => Number(w.totalPnL) === 0).length
  const winners_topWinners = mappedWinners.slice(0, 3)
  const winners_remainingWinners = mappedWinners.slice(3)
  const winners_currentUserWin = mappedWinners.find((entry) => entry?.userId === userData?.id)

  // Loading state
  if (participantLoading || leaderboardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <span className="text-blue-700 font-semibold text-lg">Loading leaderboard...</span>
          </div>
        </div>
      </div>
    )
  }

  // No ongoing contest
  if (!ongoingContest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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

  // No leaderboard data
  if (!leaderboardData || !leaderboardData.leaderboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
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

  // Main render function
  const renderContent = () => {
    if (activeTab === "winners") {
      return renderWinners()
    } else {
      return renderLeaderboard()
    }
  }

  // Tab component
  const TabNavigation = () => (
    <div className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
              <Trophy className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Contest Results</h1>
              <p className="text-gray-600 font-medium">{ongoingContest.contest?.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        {showWinners && hasWinningData && (
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                activeTab === "leaderboard"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span>Leaderboard</span>
            </button>
            <button
              onClick={() => setActiveTab("winners")}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                activeTab === "winners"
                  ? "bg-white text-green-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Gift className="h-4 w-4" />
              <span>Winners</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )

  const renderLeaderboard = () => (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-2 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Total</p>
                <p className="text-2xl font-bold text-gray-900">{leaderboard_totalParticipants}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Profit</p>
                <p className="text-2xl font-bold text-emerald-600">{leaderboard_profitCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Loss</p>
                <p className="text-2xl font-bold text-red-500">{leaderboard_lossCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Break Even</p>
                <p className="text-2xl font-bold text-gray-600">{leaderboard_breakEvenCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top 3 Podium */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">Top Performers</h2>
          <div className="flex items-end justify-center space-x-2 md:space-x-8 mb-6 md:mb-8">
            {/* Second Place */}
            {leaderboard_topWinners[1] && (
              <div className="flex flex-col items-center w-20 md:w-28">
                <div className="relative mb-2 md:mb-4">
                  <div className="w-12 h-12 md:w-20 md:h-20 rounded-full border-4 border-gray-300 shadow-lg overflow-hidden">
                    {getUserAvatar(leaderboard_topWinners[1].user)}
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-gray-400 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xs md:text-sm">2</span>
                  </div>
                </div>
                <div className={`${getPodiumColor(2)} ${getPodiumHeight(2)} w-12 md:w-24 rounded-t-lg flex items-end justify-center pb-1 md:pb-2 shadow-lg`}>
                  <Medal className="h-4 w-4 md:h-6 md:w-6 text-gray-600" />
                </div>
                <div className="text-center mt-2 md:mt-3">
                  <p className="font-bold text-gray-900 capitalize text-xs md:text-base">{leaderboard_topWinners[1].userName}</p>
                  <p className="text-xs md:text-lg font-bold text-emerald-600">₹{formatPnL(leaderboard_topWinners[1].totalPnL)}</p>
                  <p className="text-xs md:text-sm text-gray-600">{formatROI(leaderboard_topWinners[1].roi)}% ROI</p>
                </div>
              </div>
            )}
            {/* First Place */}
            {leaderboard_topWinners[0] && (
              <div className="flex flex-col items-center w-24 md:w-36">
                <div className="relative mb-2 md:mb-4">
                  <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-yellow-400 shadow-xl overflow-hidden">
                    {getUserAvatar(leaderboard_topWinners[0].user)}
                  </div>
                  <div className="absolute -top-3 -right-3 w-7 h-7 md:w-10 md:h-10 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                    <Crown className="h-4 w-4 md:h-5 md:w-5 text-yellow-800" />
                  </div>
                </div>
                <div className={`${getPodiumColor(1)} ${getPodiumHeight(1)} w-16 md:w-28 rounded-t-lg flex items-end justify-center pb-1 md:pb-2 shadow-xl`}>
                  <Trophy className="h-5 w-5 md:h-8 md:w-8 text-yellow-600" />
                </div>
                <div className="text-center mt-2 md:mt-3">
                  <p className="font-bold text-gray-900 text-sm md:text-lg capitalize">{leaderboard_topWinners[0].userName}</p>
                  <p className="text-base md:text-xl font-bold text-emerald-600">₹{formatPnL(leaderboard_topWinners[0].totalPnL)}</p>
                  <p className="text-xs md:text-sm text-gray-600">{formatROI(leaderboard_topWinners[0].roi)}% ROI</p>
                  <div className="flex items-center justify-center mt-1">
                    <Star className="h-3 w-3 md:h-4 md:w-4 text-yellow-500 mr-1" />
                    <span className="text-xs text-yellow-600 font-medium">Champion</span>
                  </div>
                </div>
              </div>
            )}
            {/* Third Place */}
            {leaderboard_topWinners[2] && (
              <div className="flex flex-col items-center w-20 md:w-28">
                <div className="relative mb-2 md:mb-4">
                  <div className="w-12 h-12 md:w-20 md:h-20 rounded-full border-4 border-amber-400 shadow-lg overflow-hidden">
                    {getUserAvatar(leaderboard_topWinners[2].user)}
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xs md:text-sm">3</span>
                  </div>
                </div>
                <div className={`${getPodiumColor(3)} ${getPodiumHeight(3)} w-12 md:w-24 rounded-t-lg flex items-end justify-center pb-1 md:pb-2 shadow-lg`}>
                  <Award className="h-4 w-4 md:h-6 md:w-6 text-amber-600" />
                </div>
                <div className="text-center mt-2 md:mt-3">
                  <p className="font-bold text-gray-900 capitalize text-xs md:text-base">{leaderboard_topWinners[2].userName}</p>
                  <p className="text-xs md:text-lg font-bold text-emerald-600">₹{formatPnL(leaderboard_topWinners[2].totalPnL)}</p>
                  <p className="text-xs md:text-sm text-gray-600">{formatROI(leaderboard_topWinners[2].roi)}% ROI</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Current User Position (if not in top 3) */}
        {leaderboard_currentUserWin && leaderboard_currentUserWin.rank > 3 && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-6 mb-8 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-blue-100 text-sm font-medium">Your Position</p>
                  <p className="text-xl font-bold">Rank #{leaderboard_currentUserWin.rank}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">₹{formatPnL(leaderboard_currentUserWin.totalPnL)}</p>
                <p className="text-blue-100">{formatROI(leaderboard_currentUserWin.roi)}% ROI</p>
              </div>
            </div>
          </div>
        )}

        {/* Remaining Participants */}
        {leaderboard_remainingWinners.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">All Participants</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {leaderboard_remainingWinners.map((entry) => {
                const pnl = entry.totalPnL || 0
                const roi = entry.roi || 0
                const isCurrentUser = entry.userId === userData.id

                return (
                  <div
                    key={entry.userId}
                    className={`p-6 hover:bg-gray-50 transition-colors duration-200 ${
                      isCurrentUser ? "bg-blue-50 border-l-4 border-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 font-bold text-sm">#{entry.rank}</span>
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-full overflow-hidden shadow-md">
                          {getUserAvatar(entry.user)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 flex items-center">
                            {entry.userName}
                            {isCurrentUser && (
                              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">Rank #{entry.rank}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2 justify-end mb-1">
                          <span
                            className={`font-bold text-lg ${
                              pnl > 0 ? "text-emerald-600" : pnl < 0 ? "text-red-500" : "text-gray-500"
                            }`}
                          >
                            ₹{formatPnL(pnl)}
                          </span>
                          {pnl > 0 && <TrendingUp className="h-4 w-4 text-emerald-600" />}
                          {pnl < 0 && <TrendingDown className="h-4 w-4 text-red-500" />}
                        </div>
                        <p
                          className={`text-sm font-medium ${
                            roi > 0 ? "text-emerald-600" : roi < 0 ? "text-red-500" : "text-gray-500"
                          }`}
                        >
                          {roi > 0 ? "+" : ""}
                          {formatROI(roi)}% ROI
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Prize Distribution */}
        {prizeDistributions && prizeDistributions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 mt-8 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Trophy className="h-5 w-5 text-green-600 mr-2" />
                Prize Distribution
              </h3>
            </div>
            <div className="p-6">
              {prizeLoading ? (
                <div className="text-gray-500 text-sm">Loading prizes...</div>
              ) : (
                <div className="grid gap-3">
                  {prizeDistributions.map((prize) => (
                    <div
                      key={prize.id}
                      className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200"
                    >
                      <span className="font-medium text-green-900">
                        Rank {prize.fromRank}
                        {prize.fromRank !== prize.toRank ? ` - ${prize.toRank}` : ""}
                      </span>
                      <span className="font-bold text-green-700 text-lg">
                        ₹{Number(prize.amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 py-6">
          <p className="text-sm text-gray-600 font-medium mb-1">
            Last updated:{" "}
            {new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-xs text-gray-500">Auto-refresh every 30 seconds</p>
          {!showWinners && (
            <p className="text-sm text-blue-600 mt-2">
              Winners will be announced after 3:30 PM India Time
            </p>
          )}
        </div>
      </div>
    </div>
  )

  const renderWinners = () => (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Total</p>
                <p className="text-2xl font-bold text-gray-900">{winners_totalParticipants}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Profit</p>
                <p className="text-2xl font-bold text-emerald-600">{winners_profitCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Loss</p>
                <p className="text-2xl font-bold text-red-500">{winners_lossCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Break Even</p>
                <p className="text-2xl font-bold text-gray-600">{winners_breakEvenCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top 3 Podium */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">Top Winners</h2>
          <div className="flex items-end justify-center space-x-2 md:space-x-8 mb-6 md:mb-8">
            {/* Second Place */}
            {winners_topWinners[1] && (
              <div className="flex flex-col items-center w-20 md:w-28">
                <div className="relative mb-2 md:mb-4">
                  <div className="w-12 h-12 md:w-20 md:h-20 rounded-full border-4 border-gray-300 shadow-lg overflow-hidden">
                    {getUserAvatar(winners_topWinners[1].user)}
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-gray-400 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xs md:text-sm">2</span>
                  </div>
                </div>
                <div className={`${getPodiumColor(2)} ${getPodiumHeight(2)} w-12 md:w-24 rounded-t-lg flex items-end justify-center pb-1 md:pb-2 shadow-lg`}>
                  <Medal className="h-4 w-4 md:h-6 md:w-6 text-gray-600" />
                </div>
                <div className="text-center mt-2 md:mt-3">
                  <p className="font-bold text-gray-900 capitalize text-xs md:text-base">{winners_topWinners[1].userName}</p>
                  <p className="text-xs md:text-lg font-bold text-emerald-600">₹{formatPnL(winners_topWinners[1].amount)}</p>
                  <p className="text-xs md:text-sm text-gray-600">{formatROI(winners_topWinners[1].roi)}% ROI</p>
                </div>
              </div>
            )}
            {/* First Place */}
            {winners_topWinners[0] && (
              <div className="flex flex-col items-center w-24 md:w-36">
                <div className="relative mb-2 md:mb-4">
                  <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-yellow-400 shadow-xl overflow-hidden">
                    {getUserAvatar(winners_topWinners[0].user)}
                  </div>
                  <div className="absolute -top-3 -right-3 w-7 h-7 md:w-10 md:h-10 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                    <Crown className="h-4 w-4 md:h-5 md:w-5 text-yellow-800" />
                  </div>
                </div>
                <div className={`${getPodiumColor(1)} ${getPodiumHeight(1)} w-16 md:w-28 rounded-t-lg flex items-end justify-center pb-1 md:pb-2 shadow-xl`}>
                  <Trophy className="h-5 w-5 md:h-8 md:w-8 text-yellow-600" />
                </div>
                <div className="text-center mt-2 md:mt-3">
                  <p className="font-bold text-gray-900 text-sm md:text-lg capitalize">{winners_topWinners[0].userName}</p>
                  <p className="text-base md:text-xl font-bold text-emerald-600">₹{formatPnL(winners_topWinners[0].amount)}</p>
                  <p className="text-xs md:text-sm text-gray-600">{formatROI(winners_topWinners[0].roi)}% ROI</p>
                  <div className="flex items-center justify-center mt-1">
                    <Star className="h-3 w-3 md:h-4 md:w-4 text-yellow-500 mr-1" />
                    <span className="text-xs text-yellow-600 font-medium">Champion</span>
                  </div>
                </div>
              </div>
            )}
            {/* Third Place */}
            {winners_topWinners[2] && (
              <div className="flex flex-col items-center w-20 md:w-28">
                <div className="relative mb-2 md:mb-4">
                  <div className="w-12 h-12 md:w-20 md:h-20 rounded-full border-4 border-amber-400 shadow-lg overflow-hidden">
                    {getUserAvatar(winners_topWinners[2].user)}
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xs md:text-sm">3</span>
                  </div>
                </div>
                <div className={`${getPodiumColor(3)} ${getPodiumHeight(3)} w-12 md:w-24 rounded-t-lg flex items-end justify-center pb-1 md:pb-2 shadow-lg`}>
                  <Award className="h-4 w-4 md:h-6 md:w-6 text-amber-600" />
                </div>
                <div className="text-center mt-2 md:mt-3">
                  <p className="font-bold text-gray-900 capitalize text-xs md:text-base">{winners_topWinners[2].userName}</p>
                  <p className="text-xs md:text-lg font-bold text-emerald-600">₹{formatPnL(winners_topWinners[2].amount)}</p>
                  <p className="text-xs md:text-sm text-gray-600">{formatROI(winners_topWinners[2].roi)}% ROI</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Current User Position (if not in top 3) */}
        {winners_currentUserWin && winners_currentUserWin.rank > 3 && (
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl shadow-xl p-6 mb-8 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Gift className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-green-100 text-sm font-medium">Your Prize</p>
                  <p className="text-xl font-bold">Rank #{winners_currentUserWin.rank}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">₹{formatPnL(winners_currentUserWin.amount)}</p>
                <p className="text-green-100">{formatROI(winners_currentUserWin.roi)}% ROI</p>
              </div>
            </div>
          </div>
        )}

        {/* Remaining Winners */}
        {winners_remainingWinners.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Gift className="h-5 w-5 text-green-600 mr-2" />
                All Winners
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {winners_remainingWinners.map((entry) => {
                const pnl = entry.totalPnL || 0
                const roi = entry.roi || 0
                const isCurrentUser = entry.userId === userData.id

                return (
                  <div
                    key={entry.userId}
                    className={`p-6 hover:bg-gray-50 transition-colors duration-200 ${
                      isCurrentUser ? "bg-green-50 border-l-4 border-green-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 font-bold text-sm">#{entry.rank}</span>
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-full overflow-hidden shadow-md">
                          {getUserAvatar(entry.user)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 flex items-center">
                            {entry.userName}
                            {isCurrentUser && (
                              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">Rank #{entry.rank}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2 justify-end mb-1">
                          <span className="font-bold text-lg text-green-600">
                            ₹{formatPnL(entry.amount)}
                          </span>
                          <Gift className="h-4 w-4 text-green-600" />
                        </div>
                        <p className="text-sm text-gray-600">
                          Performance: ₹{formatPnL(pnl)} ({roi > 0 ? "+" : ""}{formatROI(roi)}% ROI)
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 py-6">
          <p className="text-sm text-gray-600 font-medium mb-1">
            Last updated:{" "}
            {new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-xs text-gray-500">Auto-refresh every 30 seconds</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <TabNavigation />
      {renderContent()}
    </div>
  )
}