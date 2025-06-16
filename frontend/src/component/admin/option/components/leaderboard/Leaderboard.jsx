import { useGetLeaderStateQuery } from '@/store/api/contest'
import React, { useEffect, useState, useCallback } from 'react'
import { usePriceStreams } from '@/hooks/use-price-streams'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { 
  Trophy, Users, DollarSign, Target, ChevronUp, ChevronDown,
  TrendingUp, TrendingDown, Activity, Clock, Info, User, RefreshCcw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, differenceInSeconds, formatDistanceToNow } from "date-fns"
import "./leaderboard.css"

export default function Leaderboard() {
  const { data: leaderboardData, isLoading, isError, refetch } = useGetLeaderStateQuery();
  const [realTimeData, setRealTimeData] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!realTimeData?.contestInfo?.endTime) return;

    const updateTimer = () => {
      const seconds = differenceInSeconds(new Date(realTimeData.contestInfo.endTime), new Date());
      if (seconds <= 0) {
        setTimeRemaining('Contest ended');
        return;
      }
      setTimeRemaining(formatDistanceToNow(new Date(realTimeData.contestInfo.endTime), { addSuffix: true }));
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [realTimeData?.contestInfo?.endTime]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  useEffect(() => {
    if (leaderboardData) {
      setRealTimeData(leaderboardData);
    }
  }, [leaderboardData]);

  // Use the custom hook for price streams
  usePriceStreams(realTimeData, setRealTimeData);

  if (isLoading) return (
    <div className="space-y-6 p-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-8 shadow-lg">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-40 mb-8" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
              <Skeleton className="h-8 w-8 rounded" />
              <div className="flex-1">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (isError) return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <Alert variant="destructive" className="max-w-md">
        <Info className="h-5 w-5" />
        <AlertTitle>Error loading leaderboard</AlertTitle>
        <AlertDescription>
          There was a problem loading the contest data. 
          <Button
            variant="link"
            className="p-0 h-auto ml-2"
            onClick={handleRefresh}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );

  if (!realTimeData) return null;

  const userRankChange = (userId) => {
    const prevRank = leaderboardData?.leaderboard.find(p => p.userId === userId)?.rank || 0;
    const currentRank = realTimeData.leaderboard.find(p => p.userId === userId)?.rank || 0;
    return prevRank - currentRank;
  };

  return (
    <div className="space-y-6 p-6">
  
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average ROI</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "text-lg font-bold transition-colors",
                    realTimeData.contestStats.averageROI >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {realTimeData.contestStats.averageROI.toFixed(2)}%
                  </div>
                  <Progress 
                    value={Math.min(Math.abs(realTimeData.contestStats.averageROI), 100)} 
                    className={cn(
                      "mt-2 transition-all",
                      realTimeData.contestStats.averageROI >= 0 ? "bg-green-100" : "bg-red-100"
                    )}
                  />
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Average return on investment across all participants</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Highest P&L</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "text-lg font-bold transition-colors",
                    realTimeData.contestStats.highestPnL >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    ₹{realTimeData.contestStats.highestPnL.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contest leader's profit/loss
                  </p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Highest profit/loss achieved in the contest</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Activity</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    {realTimeData.contestStats.totalTradingVolume.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Combined trades across all participants
                  </p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Total number of trades executed in the contest</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Live Rankings</CardTitle>
              <CardDescription>Real-time performance tracking</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-500 animate-pulse" />
              <span className="text-sm font-medium text-green-500">Live</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Trader</TableHead>
                <TableHead className="text-right hidden md:table-cell">Portfolio Value</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right hidden lg:table-cell">ROI</TableHead>
                <TableHead className="text-right hidden lg:table-cell">24h Change</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {realTimeData.leaderboard.map((participant) => {
                const rankChange = userRankChange(participant.userId);
                const isRankImproved = rankChange > 0;
                const isRankDeclined = rankChange < 0;

                return (
                  <React.Fragment key={participant.userId}>
                    <TableRow className={cn(
                      "cursor-pointer transition-all duration-300",
                      participant.isCurrentUser && "bg-blue-50/50",
                      expandedUser === participant.userId && "bg-slate-50",
                      "hover:bg-slate-50",
                      isRankImproved && "animate-highlight-green",
                      isRankDeclined && "animate-highlight-red"
                    )}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {participant.rank === 1 ? (
                            <Trophy className="h-5 w-5 text-yellow-500 animate-bounce" />
                          ) : participant.rank === 2 ? (
                            <Trophy className="h-5 w-5 text-gray-400" />
                          ) : participant.rank === 3 ? (
                            <Trophy className="h-5 w-5 text-amber-600" />
                          ) : (
                            <span className="pl-2">{participant.rank}</span>
                          )}
                          {rankChange !== 0 && (
                            <div className="flex items-center gap-1">
                              {isRankImproved ? (
                                <ChevronUp className="h-4 w-4 text-green-500 animate-bounce" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-red-500 animate-bounce" />
                              )}
                              <span className={cn(
                                "text-xs",
                                isRankImproved ? "text-green-500" : "text-red-500"
                              )}>
                                {Math.abs(rankChange)}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            {participant.userImage ? (
                              <AvatarImage src={participant.userImage} />
                            ) : (
                              <AvatarFallback>
                                <User className="h-4 w-4" />
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <p className="font-medium line-clamp-1">{participant.userName}</p>
                            <p className="text-xs text-muted-foreground">
                              {participant.tradingStats.totalTrades} trades
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium hidden md:table-cell">
                        ₹{participant.portfolioValue.toLocaleString(undefined, { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </TableCell>
                      <TableCell>
                        <div className={cn(
                          "flex items-center justify-end gap-1 transition-colors",
                          participant.totalPnL >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {participant.totalPnL >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span className="font-medium">
                            ₹{participant.totalPnL.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={cn(
                        "text-right hidden lg:table-cell",
                        participant.roi >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {participant.roi.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedUser(
                            expandedUser === participant.userId ? null : participant.userId
                          )}
                          className="transition-transform hover:scale-110"
                        >
                          {expandedUser === participant.userId ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedUser === participant.userId && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-slate-50 p-0">
                          <div className="p-4 space-y-4">
                            <Tabs defaultValue="positions" className="w-full">
                              <TabsList className="w-full md:w-auto">
                                <TabsTrigger value="positions" className="flex-1 md:flex-none">
                                  Positions
                                </TabsTrigger>
                                <TabsTrigger value="trades" className="flex-1 md:flex-none">
                                  Recent Trades
                                </TabsTrigger>
                                <TabsTrigger value="stats" className="flex-1 md:flex-none">
                                  Statistics
                                </TabsTrigger>
                              </TabsList>

                              <TabsContent value="positions" className="mt-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  {participant.activePositions.map((position, idx) => (
                                    <Card key={idx} className="transition-all hover:shadow-md">
                                      <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className="font-medium">{position.symbol}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                              <Badge
                                                variant={position.optionType === 'CE' ? 'default' : 'destructive'}
                                                className="animate-fade-in"
                                              >
                                                {position.optionType}
                                              </Badge>
                                              <span className="text-sm text-muted-foreground">
                                                Strike: {position.strikePrice}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-sm text-muted-foreground">
                                              Qty: {position.quantity}
                                            </p>
                                            <p className={cn(
                                              "font-medium transition-colors",
                                              position.pnl >= 0 ? "text-green-600" : "text-red-600"
                                            )}>
                                              P&L: ₹{position.pnl.toFixed(2)}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                          <div>
                                            <p className="text-muted-foreground">Avg Price</p>
                                            <p className="font-medium">₹{position.averagePrice.toFixed(2)}</p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-muted-foreground">Current</p>
                                            <p className="font-medium animate-pulse">
                                              ₹{position.currentPrice.toFixed(2)}
                                            </p>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                  {participant.activePositions.length === 0 && (
                                    <p className="text-center text-muted-foreground py-4 col-span-2">
                                      No active positions
                                    </p>
                                  )}
                                </div>
                              </TabsContent>

                              <TabsContent value="trades" className="mt-4">
                                <div className="space-y-2">
                                  {participant.recentTrades?.map((trade, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg border">
                                      <div>
                                        <p className="font-medium">{trade.symbol}</p>
                                        <div className="flex items-center gap-2">
                                          <Badge variant={trade.optionType === 'CE' ? 'default' : 'destructive'}>
                                            {trade.optionType}
                                          </Badge>
                                          <span className="text-sm text-muted-foreground">
                                            {trade.action.toUpperCase()}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-medium">₹{trade.price.toFixed(2)}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {format(new Date(trade.timestamp), "pp")}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </TabsContent>
                              <TabsContent value="stats" className="mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <Card>
                                    <CardContent className="p-4">
                                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Trading Activity</h4>
                                      <div className="space-y-2">
                                        <div className="flex justify-between">
                                          <span>Total Trades</span>
                                          <span className="font-medium">{participant.tradingStats.totalTrades}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Buy Trades</span>
                                          <span className="font-medium">{participant.tradingStats.buyTrades}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Sell Trades</span>
                                          <span className="font-medium">{participant.tradingStats.sellTrades}</span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardContent className="p-4">
                                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Performance</h4>
                                      <div className="space-y-2">
                                        <div className="flex justify-between">
                                          <span>Unrealized P&L</span>
                                          <span className={cn(
                                            "font-medium",
                                            participant.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                                          )}>
                                            ₹{participant.unrealizedPnL.toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Realized P&L</span>
                                          <span className={cn(
                                            "font-medium",
                                            participant.realizedPnL >= 0 ? "text-green-600" : "text-red-600"
                                          )}>
                                            ₹{participant.realizedPnL.toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Virtual Cash</span>
                                          <span className="font-medium">
                                            ₹{participant.virtualCash.toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}