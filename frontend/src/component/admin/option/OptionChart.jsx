"use client";

import { useState, useEffect, useRef } from "react";
import {
  Activity,
  AlertCircle,
  Trophy,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, useParams } from "react-router-dom";
import { useGetOptionsQuery } from "@/store/api/options.api";
import {
  useGetActiveContestForUserQuery,
  useGetContestByIdQuery,
} from "@/store/api/contest";
import { CompactContestInfo } from "./CompactContestInfo";
import { MobileOptionChain } from "./option-chain/MobileOptionChain";
import { DesktopOptionChain } from "./option-chain/DesktopOptionChain";
import { useGetUserByIdQuery } from "@/store/api/userSliceApi";
import io from "socket.io-client";

const OptionChain = () => {
  const [selectedIndex, setSelectedIndex] = useState("NSE_INDEX|Nifty 50");
  const [selectedExpiry, setSelectedExpiry] = useState("2025-06-12");
  const { data: activeContest, isLoading: activeContestLoading } =
    useGetActiveContestForUserQuery();
  const { data: user } = useGetUserByIdQuery();
  const [optionChainData, setOptionChainData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expiryDates, setExpiryDates] = useState([]);
  const navigate = useNavigate();
  const atmRowRef = useRef(null);
  const { id } = useParams();

  const {
    data: contestData,
    error: contestError,
    isLoading: contestLoading,
  } = useGetContestByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgument: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const {
    data: initialData,
    error: queryError,
    isLoading: queryLoading,
  } = useGetOptionsQuery({
    expiry_date: selectedExpiry,
    instrument_key: selectedIndex,
  });

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

  useEffect(() => {
    setIsLoading(true);
    setConnectionStatus("connecting");
    setError(null);
    let socket;
    if (selectedIndex && selectedExpiry) {
      socket = io("/", {
        transports: ["websocket"],
        reconnection: true,
      });
      socket.on("connect", () => {
        setConnectionStatus("connected");
        socket.emit("optionChain:subscribe", {
          instrument_key: selectedIndex,
          expiry_date: selectedExpiry,
        });
      });
      socket.on("optionChain:data", (apiResponse) => {
        if (apiResponse.success && apiResponse.option_chain) {
          processOptionData(apiResponse);
          setConnectionStatus("connected");
        } else if (apiResponse.message && !apiResponse.success) {
          setError(apiResponse.message);
          setConnectionStatus("error");
        }
      });
      socket.on("optionChain:error", (err) => {
        setError(err.message || "Error in option chain stream");
        setConnectionStatus("error");
      });
      socket.on("disconnect", () => {
        setConnectionStatus("disconnected");
      });
      socket.on("connect_error", (err) => {
        setError("Socket.IO connection error");
        setConnectionStatus("error");
      });
    }
    return () => {
      if (socket) {
        socket.emit("optionChain:unsubscribe");
        socket.disconnect();
      }
      setConnectionStatus("disconnected");
    };
  }, [selectedIndex, selectedExpiry]);

  useEffect(() => {
    const fetchExpiryDates = async () => {
      try {
        const response = await fetch(
          `/api/v1/available-expiry-dates?instrument_key=${selectedIndex}`
        );
        const data = await response.json();

        if (data.success && data.expiry_dates) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const filteredDates = data.expiry_dates.filter((date) => {
            const expiryDate = new Date(date);
            return expiryDate >= today;
          });

          filteredDates.sort((a, b) => new Date(a) - new Date(b));
          setExpiryDates(filteredDates);

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

    // Check if user has active contest participation
    if (!activeContest) {
      // Show participation prompt instead of navigating
      return;
    }

    const optionData =
      type === "call" ? strikeData.call_option : strikeData.put_option;
    if (!optionData?.instrument_key) return;

    navigate(
      `/option-details/${id}/${optionData.instrument_key}?type=${type}&strike=${strikeData.strike_price}`
    );
  };

  const handleParticipateInContest = () => {
    // Navigate to contest participation page
    navigate("/contests");
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
    if (oi >= 10000000) return `${(oi / 10000000).toFixed(2)}Cr`;
    if (oi >= 100000) return `${(oi / 100000).toFixed(2)}L`;
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

    const strikes = optionChainData.option_chain.map(
      (item) => item.strike_price
    );
    return strikes.reduce((prev, curr) =>
      Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
    );
  };

  const atmStrike = getATMStrike();

  // Show participation prompt if no active contest
  const showParticipationPrompt = !activeContestLoading && !activeContest;

  // Get underlying info for header
  const underlyingInfo = optionChainData?.underlying_info;
  const spotPrice = underlyingInfo?.spot_price || 0;
  const priceChange = underlyingInfo?.change || 0;
  const priceChangePercent = underlyingInfo?.change_percent || 0;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Underlying Info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg text-nowrap font-bold text-white">
                NSE:{" "}
                {selectedIndex.includes("Nifty Bank")
                  ? "Nifty Bank"
                  : selectedIndex.includes("Nifty 50")
                  ? "Nifty 50"
                  : "Nifty Fin Service"}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white">
                  {spotPrice.toLocaleString()}
                </span>
                <div
                  className={`flex items-center gap-1 ${
                    priceChange >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {priceChange >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="font-medium">
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="bg-green-600 text-white border-green-500"
                >
                  LIVE
                </Badge>
              </div>
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`}
              ></div>
              {/* <span className="text-sm text-slate-400 capitalize">{connectionStatus}</span> */}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-6">
            <button className="text-blue-400 border-b-2 border-blue-400 pb-2 font-medium">
              Option Chain
            </button>
            {/* <button className="text-slate-400 hover:text-slate-300 pb-2">Futures Contract</button> */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
          <div className="lg:col-span-5">
            {/* Controls */}
            <div className="bg-slate-900 rounded-lg p-4 mb-6 border border-slate-800">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex  sm:flex-row gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Exp:</span>
                    <Select
                      value={selectedExpiry}
                      onValueChange={setSelectedExpiry}
                    >
                      <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {expiryDates.map((date) => (
                          <SelectItem
                            key={date}
                            value={date}
                            className="text-white hover:bg-slate-700"
                          >
                            {new Date(date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Select
                      value={selectedIndex}
                      onValueChange={setSelectedIndex}
                    >
                      <SelectTrigger className="w-[160px] bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem
                          value="NSE_INDEX|Nifty Bank"
                          className="text-white hover:bg-slate-700"
                        >
                          BANKNIFTY
                        </SelectItem>
                        <SelectItem
                          value="NSE_INDEX|Nifty 50"
                          className="text-white hover:bg-slate-700"
                        >
                          NIFTY
                        </SelectItem>
                        <SelectItem
                          value="NSE_INDEX|Nifty Fin Service"
                          className="text-white hover:bg-slate-700"
                        >
                          FINNIFTY
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

              </div>
            </div>

            {/* Contest Participation Alert */}
            {showParticipationPrompt && (
              <Alert className="mb-6 border-orange-600 bg-orange-900/20">
                <Trophy className="h-4 w-4 text-orange-400" />
                <AlertDescription className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-orange-300">
                      Join a Contest to Start Trading
                    </span>
                    <span className="text-sm text-orange-400">
                      You need to participate in a contest before you can place
                      trades.
                    </span>
                  </div>
                  <Button
                    onClick={handleParticipateInContest}
                    className="bg-orange-600 hover:bg-orange-700 text-white ml-4"
                    size="sm"
                  >
                    <Trophy className="h-4 w-4 mr-1" />
                    Join Contest
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Compact Contest Info */}
            {activeContest && <CompactContestInfo contestData={contestData} />}

            {/* Option Chain */}
            {isLoading ? (
              <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="grid grid-cols-5 gap-4">
                      {[1, 2, 3, 4, 5].map((j) => (
                        <Skeleton
                          key={j}
                          className="h-12 w-full bg-slate-800"
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="bg-slate-900 rounded-lg p-8 border border-slate-800 text-center">
                <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-400 font-medium">{error}</p>
              </div>
            ) : (
              <>
                <MobileOptionChain
                  data={optionChainData}
                  contestData={contestData}
                  onOptionClick={handleOptionClick}
                  formatPrice={formatPrice}
                  formatOI={formatOI}
                  atmStrike={atmStrike}
                  disabled={showParticipationPrompt}
                />
                {/* <DesktopOptionChain
                  data={optionChainData}
                  onOptionClick={handleOptionClick}
                  formatPrice={formatPrice}
                  formatOI={formatOI}
                  atmStrike={atmStrike}
                  calculatePriceChange={calculatePriceChange}
                  disabled={showParticipationPrompt}
                /> */}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-3">
            <Card className="h-full bg-slate-900 border-slate-800">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <Activity className="h-4 w-4" />
                  Positions & Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {/* Contest Status */}
                {showParticipationPrompt ? (
                  <div className="text-center py-8 space-y-4">
                    <AlertCircle className="h-12 w-12 text-orange-400 mx-auto" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-300">
                        No Active Contest
                      </p>
                      <p className="text-xs text-slate-500">
                        Join a contest to view positions and place trades
                      </p>
                    </div>
                    <Button
                      onClick={handleParticipateInContest}
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      <Trophy className="h-3 w-3 mr-1" />
                      Browse Contests
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Active Contest Badge */}
                    {activeContest && (
                      <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="h-4 w-4 text-green-400" />
                          <Badge
                            variant="outline"
                            className="bg-green-900/50 text-green-300 border-green-600"
                          >
                            Active Contest
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-green-300">
                          {activeContest.contest.name}
                        </p>
                        <p className="text-xs text-green-400">
                          Virtual Cash: ₹
                          {Number.parseInt(
                            activeContest.virtual_cash
                          ).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {/* Positions */}
                    <div>
                      <h3 className="text-sm font-medium mb-3 text-slate-300">
                        Open Positions
                      </h3>
                      {contestData?.contest?.participation?.positions?.length >
                      0 ? (
                        <div className="space-y-3">
                          {contestData.contest.participation.positions.map(
                            (position) => (
                              <div
                                key={position.id}
                                className="p-3 rounded-lg border border-slate-700 bg-slate-800/50"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium text-slate-300">
                                    {position.strikePrice} {position.optionType}
                                  </span>
                                  <Badge
                                    variant={
                                      position.pnl >= 0
                                        ? "default"
                                        : "destructive"
                                    }
                                    className={`text-xs ${
                                      position.pnl >= 0
                                        ? "bg-green-600 text-white"
                                        : "bg-red-600 text-white"
                                    }`}
                                  >
                                    {position.pnl >= 0 ? "+" : ""}
                                    {position.pnl.toFixed(2)}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                                  <div>Qty: {position.quantity}</div>
                                  <div>Avg: ₹{position.averagePrice}</div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-slate-500 text-sm">
                          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          No positions
                        </div>
                      )}
                    </div>

                    {/* Recent Orders */}
                    <div>
                      <h3 className="text-sm font-medium mb-3 text-slate-300">
                        Recent Orders
                      </h3>
                      <div className="text-center py-6 text-slate-500 text-sm">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No recent orders
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptionChain;
