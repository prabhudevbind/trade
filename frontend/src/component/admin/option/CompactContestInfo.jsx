"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { TimerIcon, Users, Activity, ClipboardList } from "lucide-react"

export function CompactContestInfo({ contestData }) {
  if (!contestData?.contest) return null

  const formatMoney = (amount) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
    return `₹${amount}`
  }

  const formatTimeDistance = (dateString) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "Invalid date"
      return formatDistanceToNow(date, { addSuffix: true })
    } catch (error) {
      return "Invalid date"
    }
  }

  const calculateTotalPnL = (positions) => {
    if (!positions?.length) return 0
    return positions.reduce((total, pos) => total + pos.pnl, 0)
  }

  const contest = contestData.contest
  const participation = contest.participation
  const totalPnL = calculateTotalPnL(participation?.positions)

  return (
    <Card className="mb-3">
      <CardContent className="p-3">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">{contest.name}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <TimerIcon className="h-3 w-3" />
                {formatTimeDistance(contest.endTime)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {contest.totalParticipants}
              </span>
            </div>
          </div>
          <Badge
            variant={contest.status === "ongoing" ? "default" : contest.status === "upcoming" ? "outline" : "secondary"}
            className="text-[11px] px-2 py-0.5"
          >
            {contest.status.toUpperCase()}
          </Badge>
        </div>

        {/* Stats Row */}
        {participation && (
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div className="bg-green-50 rounded p-1 text-center">
              <div className="text-[10px] text-green-700">Balance</div>
              <div className="text-xs font-bold text-green-800">{formatMoney(participation.virtualCash)}</div>
            </div>
            <div className={`rounded p-1 text-center ${totalPnL >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              <div className="text-[10px] text-muted-foreground">P&L</div>
              <div className={`text-xs font-bold ${totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalPnL >= 0 ? "+" : ""}
                {formatMoney(totalPnL)}
              </div>
            </div>
            <div className="bg-blue-50 rounded p-1 text-center">
              <div className="text-[10px] text-blue-700">Trades</div>
              <div className="text-xs font-bold text-blue-800">
                {participation.trades_taken}/{contest.maxTrade}
              </div>
            </div>
            <div className="bg-slate-50 rounded p-1 text-center">
              <div className="text-[10px] text-slate-700">Entry</div>
              <div className="text-xs font-bold text-slate-800">{formatMoney(contest.entryFee)}</div>
            </div>
          </div>
        )}

        {/* Trade Limit Warning */}
        {participation && participation.trades_taken >= contest.maxTrade && (
          <div className="mt-2 p-1 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-xs text-red-700">
            <Activity className="h-3 w-3" />
            <span className="font-medium">Trading limit reached</span>
          </div>
        )}

      
      </CardContent>
    </Card>
  )
}
