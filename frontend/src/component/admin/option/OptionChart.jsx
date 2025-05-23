"use client";

import { useState, useEffect } from "react";
import { Calendar, BarChart3, TrendingUp, TrendingDown, Activity } from "lucide-react";
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
import { useNavigate } from "react-router-dom";
import { useGetOptionsQuery } from "@/store/api/options.api";

const OptionChain = () => {
  const [selectedIndex, setSelectedIndex] = useState("NSE_INDEX|Nifty Bank");
  const [selectedExpiry, setSelectedExpiry] = useState("2025-05-29");
  const [optionChainData, setOptionChainData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const navigate = useNavigate();

  // Fetch initial option chain data using RTK Query
  const { data: initialData, error: queryError, isLoading: queryLoading } = useGetOptionsQuery({
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
      setError(queryError?.data?.message || "Error fetching initial option chain data");
      setIsLoading(false);
      setConnectionStatus("error");
    } else if (initialData) {
      processOptionData(initialData);
      setConnectionStatus("connected");
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

  const handleOptionClick = (strikeData, type) => {
    if (!strikeData) return;
    
    const optionData = type === "call" ? strikeData.call_option : strikeData.put_option;
    if (!optionData?.instrument_key) return;
    
    navigate(`/option-details/${optionData.instrument_key}?type=${type}&strike=${strikeData.strike_price}`);
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price).replace("₹", "₹");
  };

  const formatOI = (oi) => {
    if (!oi) return "0";
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(oi);
  };

  const calculatePriceChange = (ltp, closePrice) => {
    if (!ltp || !closePrice || closePrice === 0) return { change: 0, changePercent: 0 };
    const change = ltp - closePrice;
    const changePercent = (change / closePrice) * 100;
    return { change: change.toFixed(2), changePercent: changePercent.toFixed(2) };
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected": return "bg-green-500";
      case "connecting": 
      case "reconnecting": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getATMStrike = () => {
    if (!optionChainData?.underlying_info?.spot_price) return null;
    const spotPrice = optionChainData.underlying_info.spot_price;
    
    // Find the closest strike to spot price
    const strikes = optionChainData.option_chain.map(item => item.strike_price);
    return strikes.reduce((prev, curr) => 
      Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
    );
  };

  const atmStrike = getATMStrike();

  return (
    <div className="grid grid-cols-8 mx-auto px-2 py-4 gap-4">
      <div className="col-span-6">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Select value={selectedIndex} onValueChange={setSelectedIndex}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Index" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NSE_INDEX|Nifty Bank">BANKNIFTY</SelectItem>
                <SelectItem value="NSE_INDEX|Nifty 50">NIFTY</SelectItem>
                <SelectItem value="NSE_INDEX|Nifty Fin Service">FINNIFTY</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Expiry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025-05-29">29 May 2025</SelectItem>
                <SelectItem value="2025-06-05">05 Jun 2025</SelectItem>
                <SelectItem value="2025-06-12">12 Jun 2025</SelectItem>
              </SelectContent>
            </Select>

            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`} />
              <span className="text-xs text-muted-foreground capitalize">
                {connectionStatus}
              </span>
            </div>
          </div>

          {/* Market Info */}
          {optionChainData?.underlying_info && (
            <div className="flex items-center space-x-4 text-sm">
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
              {lastUpdated && (
                <div className="text-xs text-muted-foreground">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        {optionChainData?.summary && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Call OI</p>
                  <p className="text-lg font-semibold">
                    {formatOI(optionChainData.summary.total_call_oi_lots)} lots
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Put OI</p>
                  <p className="text-lg font-semibold">
                    {formatOI(optionChainData.summary.total_put_oi_lots)} lots
                  </p>
                </div>
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Strikes</p>
                  <p className="text-lg font-semibold">
                    {optionChainData.summary.total_strikes}
                  </p>
                </div>
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
            </Card>
          </div>
        )}

        {/* Option Chain Table */}
        <div className="overflow-x-auto border rounded-lg">
          <div className="sticky top-0 bg-background z-10 border-b">
            <div className="grid grid-cols-9 text-xs font-medium text-muted-foreground py-3 px-2">
              <div className="text-center">Call OI</div>
              <div className="text-center">Call Change</div>
              <div className="text-center">Call LTP</div>
              <div className="text-center">Call IV</div>
              <div className="text-center font-bold">STRIKE</div>
              <div className="text-center">Put IV</div>
              <div className="text-center">Put LTP</div>
              <div className="text-center">Put Change</div>
              <div className="text-center">Put OI</div>
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
                    className={`grid grid-cols-9 text-xs border-b py-2 px-2 hover:bg-muted/50 ${
                      isATM ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
                    }`}
                  >
                    {/* Call OI */}
                    <div className="text-center">
                      <div className="font-medium">
                        {formatOI(strikeData.call_option?.oi_lots || 0)}
                      </div>
                      <div className={`text-xs ${
                        (strikeData.call_option?.oi_change_lots || 0) > 0 
                          ? "text-green-500" : "text-red-500"
                      }`}>
                        {(strikeData.call_option?.oi_change_lots || 0) > 0 ? "+" : ""}
                        {strikeData.call_option?.oi_change_lots || 0}
                      </div>
                    </div>

                    {/* Call Change */}
                    <div className="text-center">
                      <div className={`font-medium ${
                        callChange.change > 0 ? "text-green-500" : "text-red-500"
                      }`}>
                        {callChange.change > 0 ? "+" : ""}{callChange.change}
                      </div>
                      <div className={`text-xs ${
                        callChange.changePercent > 0 ? "text-green-500" : "text-red-500"
                      }`}>
                        ({callChange.changePercent}%)
                      </div>
                    </div>

                    {/* Call LTP */}
                    <div
                      className="text-center cursor-pointer hover:bg-muted p-1 rounded"
                      onClick={() => handleOptionClick(strikeData, "call")}
                    >
                      <div className="font-semibold">
                        {formatPrice(strikeData.call_option?.ltp || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Vol: {formatOI(strikeData.call_option?.volume || 0)}
                      </div>
                    </div>

                    {/* Call IV */}
                    <div className="text-center">
                      <div className="font-medium">
                        {(strikeData.call_option?.greeks?.iv || 0).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Δ: {(strikeData.call_option?.greeks?.delta || 0).toFixed(2)}
                      </div>
                    </div>

                    {/* Strike Price */}
                    <div className="text-center font-bold flex items-center justify-center">
                      <Badge variant={isATM ? "default" : "outline"} className="text-xs">
                        {strikeData.strike_price.toLocaleString()}
                      </Badge>
                    </div>

                    {/* Put IV */}
                    <div className="text-center">
                      <div className="font-medium">
                        {(strikeData.put_option?.greeks?.iv || 0).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Δ: {(strikeData.put_option?.greeks?.delta || 0).toFixed(2)}
                      </div>
                    </div>

                    {/* Put LTP */}
                    <div
                      className="text-center cursor-pointer hover:bg-muted p-1 rounded"
                      onClick={() => handleOptionClick(strikeData, "put")}
                    >
                      <div className="font-semibold">
                        {formatPrice(strikeData.put_option?.ltp || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Vol: {formatOI(strikeData.put_option?.volume || 0)}
                      </div>
                    </div>

                    {/* Put Change */}
                    <div className="text-center">
                      <div className={`font-medium ${
                        putChange.change > 0 ? "text-green-500" : "text-red-500"
                      }`}>
                        {putChange.change > 0 ? "+" : ""}{putChange.change}
                      </div>
                      <div className={`text-xs ${
                        putChange.changePercent > 0 ? "text-green-500" : "text-red-500"
                      }`}>
                        ({putChange.changePercent}%)
                      </div>
                    </div>

                    {/* Put OI */}
                    <div className="text-center">
                      <div className="font-medium">
                        {formatOI(strikeData.put_option?.oi_lots || 0)}
                      </div>
                      <div className={`text-xs ${
                        (strikeData.put_option?.oi_change_lots || 0) > 0 
                          ? "text-green-500" : "text-red-500"
                      }`}>
                        {(strikeData.put_option?.oi_change_lots || 0) > 0 ? "+" : ""}
                        {strikeData.put_option?.oi_change_lots || 0}
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
      <div className="col-span-2">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              Recommended Order
              <BarChart3 className="h-5 w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {optionChainData && (
              <>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Instrument:</span>
                    <span className="font-medium">
                      {selectedIndex.includes("Bank") ? "BANKNIFTY" : "NIFTY"} {atmStrike} CE
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Action:</span>
                    <Badge className="bg-green-100 text-green-800">Buy</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="font-medium">
                      {formatPrice(
                        optionChainData.option_chain.find(s => s.strike_price === atmStrike)
                          ?.call_option?.ltp || 0
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recommended Qty:</span>
                    <span className="font-medium">25 lots</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stop Loss:</span>
                    <span className="font-medium text-red-600">₹350.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target:</span>
                    <span className="font-medium text-green-600">₹550.00</span>
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>Rationale:</strong> High OI build-up in calls with positive PCR trend. 
                    Spot price showing bullish momentum near ATM strike.
                  </p>
                </div>
                
                <Button className="w-full mt-4">
                  Place Order
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OptionChain;