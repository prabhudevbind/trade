"use client";

import { useGetLeaderStateQuery } from "@/store/api/contest";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { debounce } from 'lodash';
import { io } from 'socket.io-client';

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
import { Link } from "react-router-dom";

// Custom hook for price streams
function usePriceStreams(realTimeData, setRealTimeData) {
  const socketRef = useRef(null);
  const dataUpdateQueue = useRef(new Map());
  const subscribedInstruments = useRef(new Set());

  useEffect(() => {
    if (!realTimeData?.leaderboard) return;

    // Get unique instruments from active positions
    const requiredInstruments = new Set();
    realTimeData.leaderboard.forEach(participant => {
      participant.activePositions?.forEach(position => {
        requiredInstruments.add(`NSE_FO|${position.symbol}`);
      });
    });

    // Connect to Socket.IO server if not already
    if (!socketRef.current) {
      socketRef.current = io('http://localhost:5001', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        autoConnect: true,
      });
    }
    const socket = socketRef.current;

    // Subscribe to new instruments
    requiredInstruments.forEach(instrumentKey => {
      if (!subscribedInstruments.current.has(instrumentKey)) {
        socket.emit('market:subscribe', instrumentKey);
        subscribedInstruments.current.add(instrumentKey);
      }
    });
    
    // Unsubscribe from instruments no longer needed
    Array.from(subscribedInstruments.current).forEach(instrumentKey => {
      if (!requiredInstruments.has(instrumentKey)) {
        socket.emit('market:unsubscribe', instrumentKey);
        subscribedInstruments.current.delete(instrumentKey);
      }
    });

    // Debounced update function to batch updates
    const debouncedUpdate = debounce(() => {
      if (dataUpdateQueue.current.size === 0) return;
      setRealTimeData(prevData => {
        if (!prevData?.leaderboard) return prevData;
        
        const updatedLeaderboard = prevData.leaderboard.map(participant => {
          let updatedUnrealizedPnL = 0;
          let updatedPositions = participant.activePositions?.map(position => {
            const newPrice = dataUpdateQueue.current.get(`NSE_FO|${position.symbol}`);
            if (newPrice !== undefined) {
              const positionPnL = (newPrice - position.averagePrice) * position.quantity;
              updatedUnrealizedPnL += positionPnL;
              return {
                ...position,
                currentPrice: newPrice,
                pnl: positionPnL
              };
            }
            updatedUnrealizedPnL += position.pnl || 0;
            return position;
          }) || [];
          
          // Calculate percentage P&L (ROI) for this participant
          const initialValue = (participant.virtualCash || 0) + (participant.activePositions?.reduce((sum, pos) => sum + (pos.averagePrice * pos.quantity), 0) || 0);
          const roi = initialValue > 0 ? (updatedUnrealizedPnL / initialValue) * 100 : 0;
          
          return {
            ...participant,
            activePositions: updatedPositions,
            unrealizedPnL: updatedUnrealizedPnL,
            totalPnL: updatedUnrealizedPnL + (participant.realizedPnL || 0),
            portfolioValue: (participant.virtualCash || 0) + updatedUnrealizedPnL + (participant.realizedPnL || 0),
            roi: roi
          };
        });
        
        // Sort and update ranks
        const sortedLeaderboard = updatedLeaderboard
          .sort((a, b) => b.portfolioValue - a.portfolioValue)
          .map((participant, index) => ({
            ...participant,
            rank: index + 1
          }));
        
        // Clear the update queue after processing
        dataUpdateQueue.current.clear();
        
        return {
          ...prevData,
          leaderboard: sortedLeaderboard,
          contestStats: {
            averageROI: sortedLeaderboard.reduce((sum, p) => sum + (p.roi || 0), 0) / sortedLeaderboard.length,
            highestPnL: Math.max(...sortedLeaderboard.map(p => p.totalPnL || 0)),
            totalTradingVolume: sortedLeaderboard.reduce((sum, p) => sum + (p.tradingStats?.totalTrades || 0), 0),
          }
        };
      });
    }, 1000);

    // Listen for global market data updates
    const onMarketData = (data) => {
      if (!data || !data.instrumentKey) return;
      // Defensive: handle .data.ltpc.ltp, .data.ff.marketFF.ltpc.ltp, or .data.ltp
      const newLtp =
        data.data?.ltpc?.ltp ??
        data.data?.ff?.marketFF?.ltpc?.ltp ??
        data.data?.ltp;
      if (newLtp !== undefined) {
        dataUpdateQueue.current.set(data.instrumentKey, newLtp);
        debouncedUpdate();
      }
    };
    
    socket.on('globalMarketData', onMarketData);

    // Cleanup function
    return () => {
      socket.off('globalMarketData', onMarketData);
      // Unsubscribe from all instruments
      Array.from(subscribedInstruments.current).forEach(instrumentKey => {
        socket.emit('market:unsubscribe', instrumentKey);
      });
      subscribedInstruments.current.clear();
      debouncedUpdate.cancel();
      // Optionally disconnect socket if you want to fully cleanup
      // socket.disconnect();
    };
  }, [realTimeData?.leaderboard, setRealTimeData]);
}

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

          <Link to="/contests" className="text-sm text-blue-600 mt-2">
          <Button variant="link" className="text-blue-600"> 
            View Contests
            </Button>
          </Link>
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
                          <div className="text-right min-w-[80px]">
                            <div className={cn(
                              "flex items-center gap-1 text-base font-bold",
                              participant.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {participant.unrealizedPnL >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              <span>
                                ₹{Math.abs(participant.unrealizedPnL) >= 1000
                                  ? (Math.abs(participant.unrealizedPnL) / 1000).toFixed(1) + "K"
                                  : Math.abs(participant.unrealizedPnL).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {Number.isFinite(participant.roi) ? participant.roi.toFixed(2) : "0.00"}% ROI
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
                      </CardContent>
                    </Card>
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
                          <div className={cn(
                            "flex items-center justify-end gap-1 transition-colors",
                            participant.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {participant.unrealizedPnL >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            <span className="font-medium text-sm">
                              ₹{Math.abs(participant.unrealizedPnL) >= 1000
                                ? (Math.abs(participant.unrealizedPnL) / 1000).toFixed(1) + "K"
                                : Math.abs(participant.unrealizedPnL).toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right hidden lg:table-cell",
                            participant.roi >= 0 ? "text-green-600" : "text-red-600"
                          )}
                        >
                          <span className="font-medium text-sm">
                            {Number.isFinite(participant.roi) ? participant.roi.toFixed(2) : "0.00"}%
                          </span>
                        </TableCell>
                      </TableRow>
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