"use client"
import { useState } from "react"
import { useGetContestParticipantByIdQuery } from "@/store/api/contest"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CalendarIcon, Coins, DollarSign, LineChart, Loader2, TrendingUp, Trophy, BarChart3, ChevronRight } from 'lucide-react'
import { Link, useNavigate } from "react-router-dom"
import { formatCurrency, formatDate } from "@/lib/utils"
import OptionsTrading from "../option/OptionChart"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import PositionsPage from "../positions/Positions"

export default function MyContests() {
  const router = useNavigate()
  const userId = 1 // Replace with actual user_id from auth context/store
  const { data: contestParticipant, isLoading, error } = useGetContestParticipantByIdQuery(userId)
  const [selectedContest, setSelectedContest] = useState(null)
  const [showTradingModal, setShowTradingModal] = useState(false)

  // Ensure contestParticipant is an array
  const contestParticipantArray = Array.isArray(contestParticipant)
    ? contestParticipant
    : contestParticipant?.data
      ? contestParticipant.data
      : contestParticipant
        ? [contestParticipant]
        : []

  const handleTrade = (participant) => {
    router(`/option-chain/${participant.contest.id}`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading your contests...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Error loading contests: {error?.data?.message || "Something went wrong"}</p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (contestParticipantArray.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle>No Contests Found</CardTitle>
          <CardDescription>You haven't joined any contests yet.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button variant="default" onClick={() => router("/contests")} className="mt-2">
            Browse Available Contests
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Show all joined contests in a single list (no tabs)
  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Contests</h1>
          <p className="text-muted-foreground">All contests you have joined</p>
        </div>
        <Button onClick={() => router("/contests")}>Find New Contests</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contestParticipantArray.map((participant) => (
          <ContestCard
            key={participant.id}
            participant={participant}
            handleTrade={handleTrade}
          />
        ))}
      </div>
    </div>
  )
}

function ContestCard({ participant, handleTrade }) {
  const contest = participant.contest
  const maxTrade = contest.maxTrade ?? 5 // Default to 5 if maxTrade is null
  const tradeCount = participant.trades?.length || 0
  const canTrade = true // Always enable Trade Now button

  // Calculate P&L if available
  const hasTraded = tradeCount > 0
  const initialCash = 100000 // Assuming initial virtual cash
  const currentCash = participant.virtual_cash
  const pnl = currentCash - initialCash
  const pnlPercentage = (pnl / initialCash) * 100

  return (
    <Card className="h-full flex flex-col transition-all hover:shadow-md overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-slate-100">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{contest.name}</CardTitle>
          <Badge variant="default">
            Joined
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1">
          <LineChart className="h-4 w-4" />
          {contest.trading_instrument}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2 flex-grow">
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Virtual Cash:</span>
          </div>
          <div className="font-medium text-right">{participant.virtual_cash}</div>

          {hasTraded && (
            <>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">P&L:</span>
              </div>
              <div className={`font-medium text-right `}>
                <PositionsPage onlyprice={true}/>,
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Entry Fee:</span>
          </div>
          <div className="font-medium text-right">{contest.entry_fee}</div>

          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Starts:</span>
          </div>
          <div className="font-medium text-right">{contest.start_time}</div>

          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Trades:</span>
          </div>
          <div className="font-medium text-right">
            {tradeCount}/{maxTrade}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button
          onClick={() => handleTrade(participant)}
          className="w-full"
          variant="default"
        >
          Trade Now
        </Button>
      </CardFooter>
    </Card>
  )
}
