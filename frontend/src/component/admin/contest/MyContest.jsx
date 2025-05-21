"use client"
import { useState } from "react"
import { useGetContestParticipantByIdQuery } from "@/store/api/contest"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CalendarIcon, Coins, DollarSign, LineChart, Loader2, TrendingUp, Trophy, BarChart3, ChevronRight } from 'lucide-react'
import { useNavigate } from "react-router-dom"
import { formatCurrency, formatDate } from "@/lib/utils"
import OptionsTrading from "../option/OptionChart"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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

  const handleTrade = (contest) => {
    setSelectedContest(contest)
    setShowTradingModal(true)
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
          <Button variant="default" onClick={() => router.push("/contests")} className="mt-2">
            Browse Available Contests
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Group contests by status (active, upcoming, completed)
  const activeContests = []
  const upcomingContests = []
  const completedContests = []

  contestParticipantArray.forEach((participant) => {
    const contest = participant.contest
    const now = new Date()
    const startTime = new Date(contest.start_time)
    const endTime = new Date(contest.end_time)

    if (now < startTime) {
      upcomingContests.push(participant)
    } else if (now > endTime) {
      completedContests.push(participant)
    } else {
      activeContests.push(participant)
    }
  })

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Contests</h1>
          <p className="text-muted-foreground">Manage and track your trading contests</p>
        </div>
        <Button onClick={() => router.push("/contests")}>Find New Contests</Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="active" className="relative">
            Active
            {activeContests.length > 0 && <Badge className="ml-2 bg-primary">{activeContests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming
            {upcomingContests.length > 0 && <Badge className="ml-2 bg-primary">{upcomingContests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            {completedContests.length > 0 && <Badge className="ml-2 bg-primary">{completedContests.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeContests.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                You don't have any active contests at the moment.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeContests.map((participant) => (
                <ContestCard 
                  key={participant.id} 
                  participant={participant} 
                  handleTrade={handleTrade} 
                  isActive={true} 
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingContests.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                You don't have any upcoming contests.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingContests.map((participant) => (
                <ContestCard
                  key={participant.id}
                  participant={participant}
                  handleTrade={handleTrade}
                  isActive={false}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedContests.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                You don't have any completed contests.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedContests.map((participant) => (
                <ContestCard
                  key={participant.id}
                  participant={participant}
                  handleTrade={handleTrade}
                  isActive={false}
                  isCompleted={true}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Trading Modal */}
      <Dialog open={showTradingModal} onOpenChange={setShowTradingModal}>
        <DialogContent className="max-w-6xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>
              {selectedContest?.contest?.name} - Trading Interface
            </DialogTitle>
            <DialogDescription>
              Virtual Cash: {formatCurrency(selectedContest?.virtual_cash || 0)} | 
              Trades: {selectedContest?.trades?.length || 0}/{selectedContest?.contest?.maxTrade || 5}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <OptionsTrading 
              contestId={selectedContest?.contest?.id} 
              tradingInstrument={selectedContest?.contest?.trading_instrument}
              virtualCash={selectedContest?.virtual_cash}
              onTradeComplete={() => setShowTradingModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ContestCard({ participant, handleTrade, isActive, isCompleted = false }) {
  const contest = participant.contest
  const maxTrade = contest.maxTrade ?? 5 // Default to 5 if maxTrade is null
  const tradeCount = participant.trades?.length || 0
  const canTrade = tradeCount < maxTrade && isActive && !isCompleted

  // Calculate progress percentage
  const progressPercentage = (tradeCount / maxTrade) * 100

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
          <Badge variant={isActive ? "default" : isCompleted ? "secondary" : "outline"}>
            {isActive ? "Active" : isCompleted ? "Completed" : "Upcoming"}
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
          <div className="font-medium text-right">{formatCurrency(participant.virtual_cash)}</div>

          {hasTraded && (
            <>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">P&L:</span>
              </div>
              <div className={`font-medium text-right ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnl >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%)
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Entry Fee:</span>
          </div>
          <div className="font-medium text-right">{formatCurrency(contest.entry_fee)}</div>

          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Starts:</span>
          </div>
          <div className="font-medium text-right">{formatDate(contest.start_time)}</div>

          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Trades:</span>
          </div>
          <div className="font-medium text-right">
            {tradeCount}/{maxTrade}
          </div>
        </div>

        {/* Trade progress bar */}
        <div className="mt-4 w-full bg-secondary rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full ${progressPercentage === 100 ? "bg-orange-500" : "bg-primary"}`}
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button
                  onClick={() => handleTrade(participant)}
                  disabled={!canTrade}
                  className="w-full"
                  variant={canTrade ? "default" : "secondary"}
                >
                  {canTrade ? (
                    <span className="flex items-center">
                      Trade Now <ChevronRight className="ml-1 h-4 w-4" />
                    </span>
                  ) : (
                    isCompleted
                      ? "Contest Ended"
                      : tradeCount >= maxTrade
                        ? "Trade Limit Reached"
                        : "Not Started Yet"
                  )}
                </Button>
              </div>
            </TooltipTrigger>
            {!canTrade && (
              <TooltipContent>
                {isCompleted
                  ? "This contest has ended"
                  : tradeCount >= maxTrade
                    ? `You've used all ${maxTrade} available trades`
                    : "Contest has not started yet"}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  )
}
