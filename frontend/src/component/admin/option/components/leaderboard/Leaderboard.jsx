"use client";

import { useGetLeaderStateQuery } from "@/store/api/contest";
import React, { useEffect, useState, useCallback } from "react";
import { usePriceStreams } from "@/hooks/use-price-streams";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  Users,
  Target,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Info,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInSeconds, formatDistanceToNow } from "date-fns";
import "./leaderboard.css";

export default function Leaderboard() {
  const {
    data: leaderboardData,
    isLoading,
    error,
    refetch,
  } = useGetLeaderStateQuery();
  const [realTimeData, setRealTimeData] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!realTimeData?.contestInfo?.endTime) return;

    const updateTimer = () => {
      const seconds = differenceInSeconds(
        new Date(realTimeData.contestInfo.endTime),
        new Date()
      );
      if (seconds <= 0) {
        setTimeRemaining("Contest ended");
        return;
      }
      setTimeRemaining(
        formatDistanceToNow(new Date(realTimeData.contestInfo.endTime), {
          addSuffix: true,
        })
      );
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
    // Log error and data for debugging
    if (error || leaderboardData?.error) {
      console.log("Leaderboard API error:", leaderboardData);
      console.log("error:", error);
    }
  }, [leaderboardData, error]);

  console.log("Real-time data:", error);
  // Use the custom hook for price streams
  usePriceStreams(realTimeData, setRealTimeData);

  if (isLoading)
    return (
      <div className="space-y-6 p-6">
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-8 shadow-lg">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-40 mb-8" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg bg-white/5 p-3"
              >
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

  if (error) {
    // If error object has data, show the API error message
    let errorTitle = "Error";
    let errorMsg = "There was a problem loading the leaderboard.";
    let icon = <Info className="h-8 w-8 text-red-500 mb-2" />;
    let bg = "bg-red-50 border-red-200 text-red-800";

    // If error.data exists, use its message
    if (error?.data?.error === "No participants found in the active contest") {
      errorTitle = "No Participants";
      errorMsg = "There are currently no participants in the active contest.";
      if (error.data.isParticipating === false) {
        errorMsg += " You are not participating in this contest.";
      }
      icon = <Users className="h-8 w-8 text-yellow-500 mb-2" />;
      bg = "bg-yellow-50 border-yellow-200 text-yellow-800";
    } else if (error?.data?.error) {
      errorMsg = error.data.error;
    }

    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6">
        <div
          className={`max-w-md w-full border rounded-lg shadow-sm p-8 flex flex-col items-center ${bg}`}
        >
          {icon}
          <h2 className="text-xl font-bold mb-2">{errorTitle}</h2>
          <p className="mb-4 text-center text-base">{errorMsg}</p>
          <Button variant="outline" className="mt-2" onClick={handleRefresh}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!realTimeData) return null;

  const userRankChange = (userId) => {
    const prevRank =
      leaderboardData?.leaderboard.find((p) => p.userId === userId)?.rank || 0;
    const currentRank =
      realTimeData.leaderboard.find((p) => p.userId === userId)?.rank || 0;
    return prevRank - currentRank;
  };

  return (
    <div className="space-y-3 p-2 sm:p-4 lg:p-6">
      {/* Compact Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-1 gap-3">
        {/* Primary Stats Row */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="cursor-help transition-shadow hover:shadow-md">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        AVG ROI
                      </span>
                      <Target className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div
                      className={cn(
                        "text-lg sm:text-xl font-bold transition-colors",
                        realTimeData.contestStats.averageROI >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {realTimeData.contestStats.averageROI.toFixed(1)}%
                    </div>
                    <Progress
                      value={Math.min(
                        Math.abs(realTimeData.contestStats.averageROI),
                        100
                      )}
                      className={cn(
                        "mt-1 h-1 transition-all",
                        realTimeData.contestStats.averageROI >= 0
                          ? "bg-green-100"
                          : "bg-red-100"
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
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        TOP P&L
                      </span>
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div
                      className={cn(
                        "text-lg sm:text-xl font-bold transition-colors",
                        realTimeData.contestStats.highestPnL >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      ₹
                      {Math.abs(realTimeData.contestStats.highestPnL) >= 1000
                        ? (realTimeData.contestStats.highestPnL / 1000).toFixed(
                            1
                          ) + "K"
                        : realTimeData.contestStats.highestPnL.toFixed(0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Contest leader
                    </p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Highest profit/loss achieved in the contest</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Secondary Stats */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help transition-shadow hover:shadow-md">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Total Activity
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {realTimeData.contestStats.totalTradingVolume.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        trades executed
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Mobile-Optimized Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Live Rankings</CardTitle>
              <CardDescription className="text-sm">
                Real-time updates
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-500">Live</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Card Layout */}
          <div className="block sm:hidden">
            <div className="space-y-2 p-3">
              {realTimeData.leaderboard.map((participant) => {
                const rankChange = userRankChange(participant.userId);
                const isRankImproved = rankChange > 0;
                const isRankDeclined = rankChange < 0;

                return (
                  <React.Fragment key={participant.userId}>
                    <Card
                      className={cn(
                        "transition-all duration-300 cursor-pointer",
                        participant.isCurrentUser &&
                          "ring-2 ring-blue-500/20 bg-blue-50/30",
                        expandedUser === participant.userId && "bg-slate-50",
                        isRankImproved && "animate-highlight-green",
                        isRankDeclined && "animate-highlight-red"
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          {/* Left: Rank & User Info */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              {participant.rank === 1 ? (
                                <Trophy className="h-5 w-5 text-yellow-500" />
                              ) : participant.rank === 2 ? (
                                <Trophy className="h-5 w-5 text-gray-400" />
                              ) : participant.rank === 3 ? (
                                <Trophy className="h-5 w-5 text-amber-600" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                                  <span className="text-xs font-bold">
                                    {participant.rank}
                                  </span>
                                </div>
                              )}
                              {rankChange !== 0 && (
                                <div className="flex items-center">
                                  {isRankImproved ? (
                                    <ChevronUp className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 text-red-500" />
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                {participant.userImage ? (
                                  <AvatarImage
                                    src={
                                      participant.userImage ||
                                      "/placeholder.svg"
                                    }
                                  />
                                ) : (
                                  <AvatarFallback>
                                    <User className="h-4 w-4" />
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">
                                  {participant.userName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {participant.tradingStats.totalTrades} trades
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Right: Performance & Expand */}
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div
                                className={cn(
                                  "flex items-center gap-1 text-sm font-bold",
                                  participant.totalPnL >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                )}
                              >
                                {participant.totalPnL >= 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                <span>
                                  ₹
                                  {Math.abs(participant.totalPnL) >= 1000
                                    ? (
                                        Math.abs(participant.totalPnL) / 1000
                                      ).toFixed(1) + "K"
                                    : Math.abs(participant.totalPnL).toFixed(0)}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {participant.roi.toFixed(1)}% ROI
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setExpandedUser(
                                  expandedUser === participant.userId
                                    ? null
                                    : participant.userId
                                )
                              }
                              className="h-8 w-8 p-0 flex-shrink-0"
                            >
                              {expandedUser === participant.userId ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Mobile Expanded Details */}
                    {expandedUser === participant.userId && (
                      <Card className="bg-slate-50 border-l-4 border-l-blue-500">
                        <CardContent className="p-3">
                          <Tabs defaultValue="positions" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 h-8">
                              <TabsTrigger
                                value="positions"
                                className="text-xs py-1"
                              >
                                Positions
                              </TabsTrigger>
                              <TabsTrigger
                                value="trades"
                                className="text-xs py-1"
                              >
                                Trades
                              </TabsTrigger>
                              <TabsTrigger
                                value="stats"
                                className="text-xs py-1"
                              >
                                Stats
                              </TabsTrigger>
                            </TabsList>

                            <TabsContent
                              value="positions"
                              className="mt-3 space-y-0"
                            >
                              <div className="space-y-2">
                                {participant.activePositions.map(
                                  (position, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-white rounded-lg p-2 border"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">
                                            {position.symbol}
                                          </span>
                                          <Badge
                                            variant={
                                              position.optionType === "CE"
                                                ? "default"
                                                : "destructive"
                                            }
                                            className="text-xs px-1 py-0"
                                          >
                                            {position.optionType}
                                          </Badge>
                                        </div>
                                        <span
                                          className={cn(
                                            "text-sm font-bold",
                                            position.pnl >= 0
                                              ? "text-green-600"
                                              : "text-red-600"
                                          )}
                                        >
                                          ₹{position.pnl.toFixed(0)}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-4 gap-2 text-xs">
                                        <div>
                                          <p className="text-muted-foreground">
                                            Strike
                                          </p>
                                          <p className="font-medium">
                                            {position.strikePrice}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground">
                                            Qty
                                          </p>
                                          <p className="font-medium">
                                            {position.quantity}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground">
                                            Avg
                                          </p>
                                          <p className="font-medium">
                                            ₹{position.averagePrice.toFixed(1)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground">
                                            LTP
                                          </p>
                                          <p className="font-medium">
                                            ₹{position.currentPrice.toFixed(1)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                )}
                                {participant.activePositions.length === 0 && (
                                  <p className="text-center text-muted-foreground py-4 text-sm">
                                    No active positions
                                  </p>
                                )}
                              </div>
                            </TabsContent>

                            <TabsContent
                              value="trades"
                              className="mt-3 space-y-0"
                            >
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {participant.recentTrades?.map((trade, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white rounded-lg p-2 border"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="font-medium text-sm truncate">
                                          {trade.symbol}
                                        </span>
                                        <Badge
                                          variant={
                                            trade.optionType === "CE"
                                              ? "default"
                                              : "destructive"
                                          }
                                          className="text-xs px-1 py-0"
                                        >
                                          {trade.optionType}
                                        </Badge>
                                        <span
                                          className={cn(
                                            "text-xs px-1 py-0 rounded",
                                            trade.action === "buy"
                                              ? "bg-green-100 text-green-700"
                                              : "bg-red-100 text-red-700"
                                          )}
                                        >
                                          {trade.action.toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-medium text-sm">
                                          ₹{trade.price.toFixed(1)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {format(
                                            new Date(trade.timestamp),
                                            "HH:mm"
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {(!participant.recentTrades ||
                                  participant.recentTrades.length === 0) && (
                                  <p className="text-center text-muted-foreground py-4 text-sm">
                                    No recent trades
                                  </p>
                                )}
                              </div>
                            </TabsContent>

                            <TabsContent
                              value="stats"
                              className="mt-3 space-y-0"
                            >
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white rounded-lg p-2 border">
                                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                                    Trading
                                  </h4>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span>Total</span>
                                      <span className="font-medium">
                                        {participant.tradingStats.totalTrades}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span>Buy</span>
                                      <span className="font-medium text-green-600">
                                        {participant.tradingStats.buyTrades}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span>Sell</span>
                                      <span className="font-medium text-red-600">
                                        {participant.tradingStats.sellTrades}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-white rounded-lg p-2 border">
                                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                                    Performance
                                  </h4>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span>Unrealized</span>
                                      <span
                                        className={cn(
                                          "font-medium",
                                          participant.unrealizedPnL >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                        )}
                                      >
                                        ₹{participant.unrealizedPnL.toFixed(0)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span>Realized</span>
                                      <span
                                        className={cn(
                                          "font-medium",
                                          participant.realizedPnL >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                        )}
                                      >
                                        ₹{participant.realizedPnL.toFixed(0)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span>Cash</span>
                                      <span className="font-medium">
                                        ₹
                                        {(
                                          participant.virtualCash / 1000
                                        ).toFixed(0)}
                                        K
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </CardContent>
                      </Card>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead className="min-w-[180px]">Trader</TableHead>
                  <TableHead className="text-right min-w-[100px] hidden md:table-cell">
                    Portfolio
                  </TableHead>
                  <TableHead className="text-right min-w-[80px]">P&L</TableHead>
                  <TableHead className="text-right min-w-[60px] hidden lg:table-cell">
                    ROI
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {realTimeData.leaderboard.map((participant) => {
                  const rankChange = userRankChange(participant.userId);
                  const isRankImproved = rankChange > 0;
                  const isRankDeclined = rankChange < 0;

                  return (
                    <React.Fragment key={participant.userId}>
                      <TableRow
                        className={cn(
                          "cursor-pointer transition-all duration-300",
                          participant.isCurrentUser && "bg-blue-50/50",
                          expandedUser === participant.userId && "bg-slate-50",
                          "hover:bg-slate-50",
                          isRankImproved && "animate-highlight-green",
                          isRankDeclined && "animate-highlight-red"
                        )}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            {participant.rank === 1 ? (
                              <Trophy className="h-4 w-4 text-yellow-500" />
                            ) : participant.rank === 2 ? (
                              <Trophy className="h-4 w-4 text-gray-400" />
                            ) : participant.rank === 3 ? (
                              <Trophy className="h-4 w-4 text-amber-600" />
                            ) : (
                              <span className="text-sm">
                                {participant.rank}
                              </span>
                            )}
                            {rankChange !== 0 && (
                              <div className="flex items-center">
                                {isRankImproved ? (
                                  <ChevronUp className="h-3 w-3 text-green-500" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-red-500" />
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              {participant.userImage ? (
                                <AvatarImage
                                  src={
                                    participant.userImage || "/placeholder.svg"
                                  }
                                />
                              ) : (
                                <AvatarFallback>
                                  <User className="h-4 w-4" />
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">
                                {participant.userName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {participant.tradingStats.totalTrades} trades
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium hidden md:table-cell">
                          <div className="text-sm">
                            ₹{(participant.portfolioValue / 1000).toFixed(0)}K
                          </div>
                        </TableCell>
                        <TableCell>
                          <div
                            className={cn(
                              "flex items-center justify-end gap-1 transition-colors",
                              participant.totalPnL >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            )}
                          >
                            {participant.totalPnL >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            // ...existing code...


{/* <span className={`font-medium text-sm ${participant.realizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
  {participant.realizedPnL >= 0 ? "Profit: " : "Loss: "}
  ₹
  {Math.abs(participant.realizedPnL) >= 1000
    ? (Math.abs(participant.realizedPnL) / 1000).toFixed(1) + "K"
    : Math.abs(participant.realizedPnL).toFixed(0)}
</span> */}


<span className={`font-medium text-xs ${participant.unrealizedPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
  (Unrealized: ₹
  {Math.abs(participant.unrealizedPnL) >= 1000
    ? (Math.abs(participant.unrealizedPnL) / 1000).toFixed(1) + "K"
    : Math.abs(participant.unrealizedPnL).toFixed(0)})
</span>



                          </div>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right hidden lg:table-cell",
                            participant.roi >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          )}
                        >
                          <span className="font-medium text-sm">
                            {participant.roi.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedUser(
                                expandedUser === participant.userId
                                  ? null
                                  : participant.userId
                              )
                            }
                            className="h-8 w-8 p-0"
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
                          <TableCell colSpan={6} className="bg-slate-50 p-4">
                            <Tabs defaultValue="positions" className="w-full">
                              <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:grid-cols-none sm:flex">
                                <TabsTrigger value="positions">
                                  Positions
                                </TabsTrigger>
                                <TabsTrigger value="trades">Trades</TabsTrigger>
                                <TabsTrigger value="stats">Stats</TabsTrigger>
                              </TabsList>

                              <TabsContent value="positions" className="mt-4">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  {participant.activePositions.map(
                                    (position, idx) => (
                                      <Card
                                        key={idx}
                                        className="transition-all hover:shadow-md"
                                      >
                                        <CardContent className="p-3">
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <p className="font-medium text-sm">
                                                {position.symbol}
                                              </p>
                                              <Badge
                                                variant={
                                                  position.optionType === "CE"
                                                    ? "default"
                                                    : "destructive"
                                                }
                                              >
                                                {position.optionType}
                                              </Badge>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div>
                                                <p className="text-muted-foreground">
                                                  Strike
                                                </p>
                                                <p className="font-medium">
                                                  {position.strikePrice}
                                                </p>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-muted-foreground">
                                                  Qty
                                                </p>
                                                <p className="font-medium">
                                                  {position.quantity}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-muted-foreground">
                                                  Avg Price
                                                </p>
                                                <p className="font-medium">
                                                  ₹
                                                  {position.averagePrice.toFixed(
                                                    1
                                                  )}
                                                </p>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-muted-foreground">
                                                  Current
                                                </p>
                                                <p className="font-medium">
                                                  ₹
                                                  {position.currentPrice.toFixed(
                                                    1
                                                  )}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="pt-1 border-t">
                                              <p
                                                className={cn(
                                                  "font-medium text-center",
                                                  position.pnl >= 0
                                                    ? "text-green-600"
                                                    : "text-red-600"
                                                )}
                                              >
                                                P&L: ₹{position.pnl.toFixed(2)}
                                              </p>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )
                                  )}
                                  {participant.activePositions.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8 col-span-full">
                                      No active positions
                                    </p>
                                  )}
                                </div>
                              </TabsContent>

                              <TabsContent value="trades" className="mt-4">
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {participant.recentTrades?.map(
                                    (trade, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-white"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <p className="font-medium text-sm truncate">
                                              {trade.symbol}
                                            </p>
                                            <Badge
                                              variant={
                                                trade.optionType === "CE"
                                                  ? "default"
                                                  : "destructive"
                                              }
                                            >
                                              {trade.optionType}
                                            </Badge>
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            {trade.action.toUpperCase()}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-medium text-sm">
                                            ₹{trade.price.toFixed(2)}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {format(
                                              new Date(trade.timestamp),
                                              "HH:mm"
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                    )
                                  )}
                                  {(!participant.recentTrades ||
                                    participant.recentTrades.length === 0) && (
                                    <p className="text-center text-muted-foreground py-8">
                                      No recent trades
                                    </p>
                                  )}
                                </div>
                              </TabsContent>

                              <TabsContent value="stats" className="mt-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <Card>
                                    <CardContent className="p-4">
                                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                                        Trading Activity
                                      </h4>
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm">
                                            Total Trades
                                          </span>
                                          <span className="font-medium">
                                            {
                                              participant.tradingStats
                                                .totalTrades
                                            }
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm">
                                            Buy Trades
                                          </span>
                                          <span className="font-medium text-green-600">
                                            {participant.tradingStats.buyTrades}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm">
                                            Sell Trades
                                          </span>
                                          <span className="font-medium text-red-600">
                                            {
                                              participant.tradingStats
                                                .sellTrades
                                            }
                                          </span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardContent className="p-4">
                                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                                        Performance
                                      </h4>
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm">
                                            Unrealized P&L
                                          </span>
                                          <span
                                            className={cn(
                                              "font-medium",
                                              participant.unrealizedPnL >= 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                            )}
                                          >
                                            ₹
                                            {participant.unrealizedPnL.toFixed(
                                              2
                                            )}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm">
                                            Realized P&L
                                          </span>
                                          <span
                                            className={cn(
                                              "font-medium",
                                              participant.realizedPnL >= 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                            )}
                                          >
                                            ₹
                                            {participant.realizedPnL.toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm">
                                            Virtual Cash
                                          </span>
                                          <span className="font-medium">
                                            ₹
                                            {participant.virtualCash.toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
