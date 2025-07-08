"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import PositionsPage from "../positions/Positions";

const OptionChain = () => {
  const [selectedIndex, setSelectedIndex] = useState("NSE_INDEX|Nifty 50");
  const [selectedExpiry, setSelectedExpiry] = useState(null);
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

  // Refs for optimization
  const socketRef = useRef(null);
  const lastDataHashRef = useRef(null);
  const updateCountRef = useRef(0);

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

  // Fast hash function for data comparison
  const fastHash = useCallback((obj) => {
    if (!obj) return "";
    const str = JSON.stringify({
      underlying: obj.underlying_info,
      timestamp: obj.timestamp,
      // Only hash critical fields for performance
      chain: obj.option_chain?.map((item) => ({
        strike: item.strike_price,
        call_ltp: item.call_option?.ltp,
        put_ltp: item.put_option?.ltp,
        call_oi: item.call_option?.oi_lots,
        put_oi: item.put_option?.oi_lots,
      })),
    });

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }, []);

  // Optimized data processing with minimal throttling
  const processOptionData = useCallback(
    (apiResponse) => {
      if (!apiResponse?.success || !apiResponse?.option_chain?.length) {
        setError(apiResponse?.message || "No option chain data available");
        setIsLoading(false);
        return;
      }

      // Fast data comparison using hash
      const currentHash = fastHash(apiResponse);
      if (currentHash === lastDataHashRef.current) {
        return; // Skip if data hasn't changed
      }

      lastDataHashRef.current = currentHash;
      updateCountRef.current += 1;

      // Use requestAnimationFrame for smooth updates
      requestAnimationFrame(() => {
        setOptionChainData(apiResponse);
        setIsLoading(false);
        setError(null);
        setLastUpdated(new Date(apiResponse.timestamp));
      });
    },
    [fastHash]
  );

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
  }, [initialData, queryError, queryLoading, processOptionData]);

  // Optimized socket connection with faster updates
  useEffect(() => {
    if (!selectedIndex || !selectedExpiry) return;

    setIsLoading(true);
    setConnectionStatus("connecting");
    setError(null);

    // Clean up previous socket
    if (socketRef.current) {
      socketRef.current.emit("optionChain:unsubscribe");
      socketRef.current.disconnect();
    }

    // Create new socket with optimized settings
    const socket = io("http://localhost:5001", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionAttempts: 10,
      timeout: 5000,
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🟢 Socket connected");
      setConnectionStatus("connected");
      socket.emit("optionChain:subscribe", {
        instrument_key: selectedIndex,
        expiry_date: selectedExpiry,
      });
    });

    // Optimized data handler - no throttling for maximum speed
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
      console.error("❌ Option chain error:", err);
      setError(err.message || "Error in option chain stream");
      setConnectionStatus("error");
    });

    socket.on("disconnect", (reason) => {
      console.log("🔴 Socket disconnected:", reason);
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err);
      // Do NOT clear optionChainData or set error
      setConnectionStatus("reconnecting");
      // Optionally, show a toast or subtle badge: "Reconnecting..."
    });

    return () => {
      if (socket) {
        socket.emit("optionChain:unsubscribe");
        socket.disconnect();
      }
      socketRef.current = null;
      setConnectionStatus("disconnected");
    };
  }, [selectedIndex, selectedExpiry, processOptionData]);

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
  }, [selectedIndex, selectedExpiry]);

  const handleOptionClick = useCallback(
    (strikeData, type) => {
      if (!strikeData) return;

      // Check if user has active contest participation
      if (!activeContest) {
        return;
      }

      const optionData =
        type === "call" ? strikeData.call_option : strikeData.put_option;
      if (!optionData?.instrument_key) return;

      navigate(
        `/option-details/${id}/${optionData.instrument_key}?type=${type}&strike=${strikeData.strike_price}`
      );
    },
    [activeContest, navigate, id]
  );

  const handleParticipateInContest = useCallback(() => {
    navigate("/contests");
  }, [navigate]);

  // Memoized utility functions
  const formatPrice = useCallback((price) => {
    if (!price || price === 0) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(price)
      .replace("₹", "₹");
  }, []);

  const formatOI = useCallback((oi) => {
    if (!oi) return "0";
    if (oi >= 10000000) return `${(oi / 10000000).toFixed(2)}Cr`;
    if (oi >= 100000) return `${(oi / 100000).toFixed(2)}L`;
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
      oi
    );
  }, []);

  const calculatePriceChange = useCallback((ltp, closePrice) => {
    if (!ltp || !closePrice || closePrice === 0)
      return { change: 0, changePercent: 0 };
    const change = ltp - closePrice;
    const changePercent = (change / closePrice) * 100;
    return {
      change: change.toFixed(2),
      changePercent: changePercent.toFixed(2),
    };
  }, []);

  const getConnectionStatusColor = useCallback(() => {
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
  }, [connectionStatus]);

  // Memoized ATM calculation
  const atmStrike = useMemo(() => {
    if (!optionChainData?.underlying_info?.spot_price) return null;
    const spotPrice = optionChainData.underlying_info.spot_price;

    const strikes = optionChainData.option_chain.map(
      (item) => item.strike_price
    );
    return strikes.reduce((prev, curr) =>
      Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
    );
  }, [optionChainData]);

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
              <h1 className=" text-base text-nowrap font-bold text-white">
                NSE:{" "}
                {selectedIndex.includes("Nifty Bank")
                  ? "Nifty Bank"
                  : selectedIndex.includes("Nifty 50")
                  ? "Nifty 50"
                  : "Nifty Fin Service"}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">
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
                  <span className="font-medium text-xs">
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Connection Status with Update Counter */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`}
              ></div>

              {lastUpdated && (
                <span className="text-xs text-slate-500">
                  {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-6 items-center justify-start">
            {/* Navigation Tabs */}
            <div className="flex gap-6">
              <button className="text-blue-400 border-b-2 border-blue-400 pb-2 font-medium bg-transparent">
                Option Chain
              </button>
            </div>
            {/* Dropdowns on right side */}
            <div className="flex gap-2">
              <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
                <SelectTrigger className="w-[120px] bg-transparent border-0 shadow-none text-white px-2 focus:ring-0 focus:outline-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-0 shadow-lg">
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
              <Select value={selectedIndex} onValueChange={setSelectedIndex}>
                <SelectTrigger className="w-[120px] bg-transparent border-0 shadow-none text-white px-2 focus:ring-0 focus:outline-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-0 shadow-lg">
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

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
          <div className="lg:col-span-5">
            {/* Controls */}

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

            {/* Option Chain */}
            {isLoading ? (
              <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="grid grid-cols-5 gap-4">
                      {[1, 2, 3, 4, 5].map((j) => (
                        <Skeleton
                          key={j}
                          className="h-10 w-full bg-slate-800"
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
                  instrumentKey={selectedIndex}
                  expiryDate={selectedExpiry}
                  instrumentExpiryKey={selectedIndex && selectedExpiry ? `${selectedIndex}:${selectedExpiry}` : ""}
                />
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-3">
            <div className="h-full text-white   overflow-y-auto bg-slate-900 over border-slate-800">
              <div className=" p-4 mb-2 border">
                {activeContest && <PositionsPage only={true} />}
              </div>

              {activeContest && <PositionsPage options={true} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptionChain;
