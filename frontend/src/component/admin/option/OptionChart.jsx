"use client";

import { useState, useEffect, useRef } from "react";
import {
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router-dom";
import { useGetOptionsQuery } from "@/store/api/options.api";
import { useGetContestByIdQuery } from "@/store/api/contest";
import { formatDistanceToNow } from 'date-fns';
import {  TimerIcon, Trophy, Users } from 'lucide-react';
import { CurrencyIcon } from "lucide-react";
const OptionChain = () => {
  const [selectedIndex, setSelectedIndex] = useState("NSE_INDEX|Nifty Bank");
  const [selectedExpiry, setSelectedExpiry] = useState("2025-06-12");
  const [optionChainData, setOptionChainData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expiryDates, setExpiryDates] = useState([]);
  const [tradesTaken, setTradesTaken] = useState(0);
  const navigate = useNavigate();
  const atmRowRef = useRef(null);
  const { id } = useParams();

  const {
    data: contestData,
    error: contestError,
    isLoading: contestLoading,
  } = useGetContestByIdQuery(id, {
    skip: !id, // Skip if no contest ID is provided
    refetchOnMountOrArgChange: true, // Refetch when component mounts or ID changes
    refetchOnFocus: true, // Refetch when the tab gains focus
    refetchOnReconnect: true, // Refetch when the network reconnect
  });
  // Fetch initial option chain data using RTK Query
  const {
    data: initialData,
    error: queryError,
    isLoading: queryLoading,
  } = useGetOptionsQuery({
    expiry_date: selectedExpiry,
    instrument_key: selectedIndex,
  });

  // Process data from the new API structure
  const processOptionData = (apiResponse) => {
    if (!apiResponse?.success || !apiResponse?.option_chain?.length) {
      setError(apiResponse?.message || "No option chain data available");
      setIsLoading(false);
      return;
    }

    setOptionChainData(apiResponse);
    setIsLoading(false);
    setError(null);
    setLastUpdated(new Date(apiResponse.timestamp));
  };

  // Handle initial data from RTK Query
  useEffect(() => {
    if (queryLoading) {
      setIsLoading(true);
      setConnectionStatus("loading");
    } else if (queryError) {
      setError(
        queryError?.data?.message || "Error fetching initial option chain data"
      );
      setIsLoading(false);
      setConnectionStatus("error");
    } else if (initialData) {
      processOptionData(initialData);
      setConnectionStatus("connected");

      // Add small delay to ensure DOM is updated
      setTimeout(() => {
        if (atmRowRef.current) {
          atmRowRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);
    }
  }, [initialData, queryError, queryLoading]);

  // Set up EventSource for 1-second streaming updates
  useEffect(() => {
    setIsLoading(true);
    setConnectionStatus("connecting");

    const eventSource = new EventSource(
      `/api/v1/option-chain-stream?instrument_key=${encodeURIComponent(
        selectedIndex
      )}&expiry_date=${selectedExpiry}`
    );

    eventSource.onopen = () => {
      setConnectionStatus("connected");
      console.log("✅ Connected to option chain stream");
    };

    eventSource.onmessage = (event) => {
      try {
        const apiResponse = JSON.parse(event.data);

        if (apiResponse.success && apiResponse.option_chain) {
          processOptionData(apiResponse);
          setConnectionStatus("connected");
        } else if (apiResponse.message && !apiResponse.success) {
          setError(apiResponse.message);
          setConnectionStatus("error");
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err);
        setError("Error processing real-time data");
      }
    };

    eventSource.onerror = (e) => {
      console.error("SSE Error:", e);
      setError("Connection to data stream lost. Trying to reconnect...");
      setConnectionStatus("reconnecting");
    };

    // Cleanup on component unmount or when dependencies change
    return () => {
      eventSource.close();
      setConnectionStatus("disconnected");
    };
  }, [selectedIndex, selectedExpiry]);

  // Fetch expiry dates when instrument changes
  useEffect(() => {
    const fetchExpiryDates = async () => {
      try {
        const response = await fetch(
          `/api/v1/available-expiry-dates?instrument_key=${selectedIndex}`
        );
        const data = await response.json();

        if (data.success && data.expiry_dates) {
          // Filter out past dates
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

          const filteredDates = data.expiry_dates.filter((date) => {
            const expiryDate = new Date(date);
            return expiryDate >= today;
          });

          // Sort dates in ascending order
          filteredDates.sort((a, b) => new Date(a) - new Date(b));

          setExpiryDates(filteredDates);

          // If current selection is in past or not in filtered list, select first available date
          const currentExpiryDate = new Date(selectedExpiry);
          if (
            currentExpiryDate < today ||
            !filteredDates.includes(selectedExpiry)
          ) {
            setSelectedExpiry(filteredDates[0]);
          }

          console.log(`✅ Loaded ${filteredDates.length} valid expiry dates`);
        }
      } catch (error) {
        console.error("Error fetching expiry dates:", error);
      }
    };

    fetchExpiryDates();
  }, [selectedIndex]);

  const handleOptionClick = (strikeData, type) => {
    if (!strikeData) return;

    const optionData =
      type === "call" ? strikeData.call_option : strikeData.put_option;
    if (!optionData?.instrument_key) return;

    navigate(
      `/option-details/${id}/${optionData.instrument_key}?type=${type}&strike=${strikeData.strike_price}`
    );
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(price)
      .replace("₹", "₹");
  };

  const formatOI = (oi) => {
    if (!oi) return "0";
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
      oi
    );
  };

  const calculatePriceChange = (ltp, closePrice) => {
    if (!ltp || !closePrice || closePrice === 0)
      return { change: 0, changePercent: 0 };
    const change = ltp - closePrice;
    const changePercent = (change / closePrice) * 100;
    return {
      change: change.toFixed(2),
      changePercent: changePercent.toFixed(2),
    };
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "bg-green-500";
      case "connecting":
      case "reconnecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getATMStrike = () => {
    if (!optionChainData?.underlying_info?.spot_price) return null;
    const spotPrice = optionChainData.underlying_info.spot_price;

    // Find the closest strike to spot price
    const strikes = optionChainData.option_chain.map(
      (item) => item.strike_price
    );
    return strikes.reduce((prev, curr) =>
      Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
    );
  };

  const atmStrike = getATMStrike();

  // Add this CSS class for mobile layout
  const mobileColumns = `
    grid-cols-5 
    md:grid-cols-9
  `;

  // Add a helper function for safe date formatting
  const formatTimeDistance = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  // Add helper function for calculating total P&L
  const calculateTotalPnL = (positions) => {
    if (!positions?.length) return 0;
    return positions.reduce((total, pos) => total + pos.pnl, 0);
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-8 mx-auto px-2 py-4 gap-4">
      <div className="  md:col-span-5">
        {/* Header Section */}

          {contestData?.contest && (
        <Card className="mb-4">
          <CardContent className="p-4">
            {/* Contest Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold mb-2">{contestData.contest.name}</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <TimerIcon className="h-4 w-4 text-muted-foreground" />
                    <span>Ends: {formatTimeDistance(contestData.contest.endTime)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CurrencyIcon className="h-4 w-4 text-muted-foreground" />
                    <span>Entry Fee: {formatMoney(contestData.contest.entryFee)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span>Max Trades: {contestData.contest.maxTrade}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Participants: {contestData.contest.totalParticipants}</span>
                  </div>
                </div>
              </div>
              <Badge variant={
                contestData.contest.status === 'ongoing' ? 'default' : 
                contestData.contest.status === 'upcoming' ? 'outline' : 
                'secondary'
              }>
                {contestData.contest.status.toUpperCase()}
              </Badge>
            </div>

            {/* Trading Summary */}
            {contestData.contest.participation && (
              <div className="mt-4 pt-4 border-t space-y-4">
                {/* Balance and P&L */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CurrencyIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Available Balance</span>
                    </div>
                    <span className="text-2xl font-bold text-green-600">
                      {formatMoney(contestData.contest.participation.virtualCash)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Total P&L</span>
                    </div>
                    <span className={`text-2xl font-bold ${
                      calculateTotalPnL(contestData.contest.participation.positions) >= 0 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {formatMoney(calculateTotalPnL(contestData.contest.participation.positions))}
                    </span>
                  </div>
                </div>

                {/* Trading Status */}
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Trading Status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {contestData.contest.participation.trades_taken}/{contestData.contest.maxTrade}
                    </span>
                    <Badge 
                      variant={
                        contestData.contest.participation.trades_taken >= contestData.contest.maxTrade 
                          ? "destructive" 
                          : "outline"
                      }
                    >
                      {contestData.contest.participation.trades_taken >= contestData.contest.maxTrade 
                        ? "Limit Reached" 
                        : `${contestData.contest.maxTrade - contestData.contest.participation.trades_taken} Remaining`
                      }
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}


        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {/* Controls Group */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="grid grid-cols-2 sm:flex gap-2">
              <Select value={selectedIndex} onValueChange={setSelectedIndex}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Select Index" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NSE_INDEX|Nifty Bank">BANKNIFTY</SelectItem>
                  <SelectItem value="NSE_INDEX|Nifty 50">NIFTY</SelectItem>
                  <SelectItem value="NSE_INDEX|Nifty Fin Service">FINNIFTY</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <Calendar className="mr-2 h-4 w-4 hidden sm:inline" />
                  <SelectValue placeholder="Expiry" />
                </SelectTrigger>
                <SelectContent>
                  {expiryDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {new Date(date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Connection Status - Show on all screens */}
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`} />
              <span className="text-xs text-muted-foreground capitalize">
                {connectionStatus}
              </span>
            </div>
          </div>

          {/* Market Info - Responsive layout */}
          {optionChainData?.underlying_info && (
            <div className="flex flex-wrap gap-4 text-sm mt-2 sm:mt-0 justify-between sm:justify-end flex-1">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Spot: </span>
                  <span className="font-semibold">
                    {formatPrice(optionChainData.underlying_info.spot_price)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">PCR: </span>
                  <span className="font-semibold">
                    {optionChainData.summary?.overall_pcr || "0.00"}
                  </span>
                </div>
              </div>
              {lastUpdated && (
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        {optionChainData?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-4">
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Call OI</p>
                  <p className="text-sm sm:text-lg font-semibold">
                    {formatOI(optionChainData.summary.total_call_oi_lots)}
                  </p>
                </div>
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Put OI</p>
                  <p className="text-sm sm:text-lg font-semibold">
                    {formatOI(optionChainData.summary.total_put_oi_lots)}
                  </p>
                </div>
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
              </div>
            </Card>
            <Card className="col-span-2 sm:col-span-1 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Strikes</p>
                  <p className="text-sm sm:text-lg font-semibold">
                    {optionChainData.summary.total_strikes}
                  </p>
                </div>
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
            </Card>
          </div>
        )}

        {/* Option Chain Table */}
        <div className="overflow-x-auto border rounded-lg">
          <div className="sticky top-0 bg-background z-10 border-b">
            <div className={`grid ${mobileColumns} text-xs font-medium text-muted-foreground py-3 px-2`}>
              {/* Only show these columns on mobile */}
              <div className="text-center md:block">Call OI</div>
              <div className="hidden md:block text-center">Call Change</div>
              <div className="text-center">Call LTP</div>
              <div className="hidden md:block text-center">Call IV</div>
              <div className="text-center font-bold">STRIKE</div>
              <div className="hidden md:block text-center">Put IV</div>
              <div className="text-center">Put LTP</div>
              <div className="hidden md:block text-center">Put Change</div>
              <div className="text-center md:block">Put OI</div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="grid grid-cols-9 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((j) => (
                    <Skeleton key={j} className="h-12 w-full" />
                  ))}
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">{error}</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {optionChainData?.option_chain?.map((strikeData, index) => {
                const isATM = strikeData.strike_price === atmStrike;
                const callChange = calculatePriceChange(
                  strikeData.call_option?.ltp,
                  strikeData.call_option?.close_price
                );
                const putChange = calculatePriceChange(
                  strikeData.put_option?.ltp,
                  strikeData.put_option?.close_price
                );

                return (
                  <div
                    key={index}
                    ref={isATM ? atmRowRef : null}
                    className={`grid ${mobileColumns} text-xs border-b py-2 px-2 hover:bg-muted/50 ${
                      isATM ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
                    }`}
                  >
                    {/* Call LTP - Mobile & Desktop */}
                    <div
                      className="text-center cursor-pointer hover:bg-muted p-1 rounded"
                      onClick={() => handleOptionClick(strikeData, "call")}
                    >
                      <div className="font-semibold">
                        {formatPrice(strikeData.call_option?.ltp || 0)}
                      </div>
                    </div>

                    {/* OI - Mobile */}
                    <div className="text-center md:hidden">
                      <div className="font-medium text-xs">
                        {formatOI(strikeData.call_option?.oi_lots || 0)}
                        <span className="text-muted-foreground"> / </span>
                        {formatOI(strikeData.put_option?.oi_lots || 0)}
                      </div>
                    </div>

                    {/* Strike Price - Mobile & Desktop */}
                    <div className="text-center font-bold">
                      <Badge
                        variant={isATM ? "default" : "outline"}
                        className="text-xs whitespace-nowrap"
                      >
                        {strikeData.strike_price.toLocaleString()}
                      </Badge>
                    </div>

                    {/* Put LTP - Mobile & Desktop */}
                    <div
                      className="text-center cursor-pointer hover:bg-muted p-1 rounded"
                      onClick={() => handleOptionClick(strikeData, "put")}
                    >
                      <div className="font-semibold">
                        {formatPrice(strikeData.put_option?.ltp || 0)}
                      </div>
                    </div>

                    {/* Desktop-only columns */}
                    <div className="hidden md:block text-center">
                      {formatOI(strikeData.call_option?.oi_lots || 0)}
                    </div>
                    <div className="hidden md:block text-center">
                      <div
                        className={`font-medium ${
                          callChange.change > 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {callChange.change > 0 ? "+" : ""}
                        {callChange.change}
                      </div>
                      <div
                        className={`text-xs ${
                          callChange.changePercent > 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        ({callChange.changePercent}%)
                      </div>
                    </div>
                    <div className="hidden md:block text-center">
                      <div className="font-medium">
                        {(strikeData.call_option?.greeks?.iv || 0).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Δ:{" "}
                        {(strikeData.call_option?.greeks?.delta || 0).toFixed(
                          2
                        )}
                      </div>
                    </div>
                    <div className="hidden md:block text-center">
                      <div className="font-medium">
                        {(strikeData.put_option?.greeks?.iv || 0).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Δ:{" "}
                        {(strikeData.put_option?.greeks?.delta || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="hidden md:block text-center">
                      <div
                        className={`font-medium ${
                          putChange.change > 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {putChange.change > 0 ? "+" : ""}
                        {putChange.change}
                      </div>
                      <div
                        className={`text-xs ${
                          putChange.changePercent > 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        ({putChange.changePercent}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - Recommended Order */}
      <div className="w-full col-span-3">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              My Orders & Positions
              <Activity className="h-5 w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Positions */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Open Positions</h3>
              {contestData?.contest?.participation?.positions?.length > 0 ? (
                <div className="space-y-3">
                  {contestData.contest.participation.positions.map((position) => (
                    <div 
                      key={position.id} 
                      className={`p-3 rounded-lg border ${
                        position.pnl >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">
                          {position.strikePrice} {position.optionType}
                        </span>
                        <Badge variant={position.pnl >= 0 ? "success" : "destructive"}>
                          {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Qty: {position.quantity}</div>
                        <div>Avg: ₹{position.averagePrice}</div>
                        <div>Current: ₹{position.currentPrice}</div>
                        <div>
                          Change: {((position.currentPrice - position.averagePrice) / position.averagePrice * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No open positions
                </div>
              )}
            </div>

            {/* Recent Trades */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Recent Trades</h3>
              <div className="space-y-2">
                {contestData?.contest?.participation?.recentTrades?.map((trade) => (
                  <div 
                    key={trade.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={trade.action === 'buy' ? 'default' : 'destructive'}>
                          {trade.action.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{trade.strikePrice}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(trade.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">₹{trade.price}</div>
                      <div className="text-muted-foreground">{trade.quantity} qty</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contest Summary */}
            <div className="border-t pt-3 mt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Virtual Cash</div>
                  <div className="font-semibold">₹{contestData?.contest?.participation?.virtualCash.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Trades Used</div>
                  <div className="font-semibold">
                    {contestData?.contest?.participation?.trades_taken}/{contestData?.contest?.maxTrade}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OptionChain;
