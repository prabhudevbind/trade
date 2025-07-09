"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Clock,
  MoveUpRight,
  ArrowLeft,
  Plus,
  Minus,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  useCreateOptionMutation,
  useCreatePositionMutation,
  useCreateTradeMutation,
} from "@/store/api/contest";
import io from "socket.io-client";
import { socketServerUrl } from "@/lib/utidata";
export function OptionDetailsDrawer({
  isOpen,
  onClose,
  instrumentExpiryKey,
  optionData: initialOptionData,
  strikePrice,
  optionType,
  expiry,
  contestData = {
    id: 31,
    user_id: 5,
    contest_id: 2,
    virtual_cash: "100000",
    joined_at: "2025-06-16T07:13:38.344Z",
    contest: {
      id: 2,
      name: "AJAY TRADING COMPANY",
      start_time: "2025-05-12T18:48:00.000Z",
      end_time: "2025-06-26T08:52:00.000Z",
      maxTrade: "6",
      entry_fee: "55",
      status: "ongoing",
      trading_instrument: "BOTH",
      created_at: "2025-05-20T10:18:37.018Z",
      updated_at: "2025-06-16T06:54:14.902Z",
    },
  },
  underlyingPrice,
  onBuy,
  onSell,
  isLoading,
}) {
  const [showTradeView, setShowTradeView] = useState(false);
  const [tradeType, setTradeType] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [optionData, setOptionData] = useState(initialOptionData);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [error, setError] = useState(null);
  const [tradeLimitReached, setTradeLimitReached] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const navigate = useNavigate();
  const { id } = useParams();

  const [createOption] = useCreateOptionMutation();
  const [createPosition] = useCreatePositionMutation();
  const [createTrade] = useCreateTradeMutation();

  // Mobile responsive sheet configuration
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isOpen || !initialOptionData?.instrument_key) return;

    const socket = io(socketServerUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    let subscribed = false;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("subscribe", initialOptionData.instrument_key);
      subscribed = true;
      console.log(
        "[Socket.IO] Connected and subscribed to",
        initialOptionData.instrument_key
      );
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("[Socket.IO] Disconnected");
    });

    socket.on("connect_error", (err) => {
      setIsConnected(false);
      console.error("Socket.IO connection error:", err);
    });

    socket.on("marketData", ({ instrumentKey, data }) => {
      if (instrumentKey === initialOptionData.instrument_key) {
        setLastUpdated(new Date());

        // Full market data update
        if (data && data.ff && data.ff.marketFF) {
          const ff = data.ff;
          setOptionData((prevData) => ({
            ...prevData,
            ltp: ff.marketFF.ltpc.ltp,
            close_price: ff.marketFF.eFeedDetails.cp,
            bid_price: ff.marketFF.marketLevel.bidAskQuote[0].bp,
            ask_price: ff.marketFF.marketLevel.bidAskQuote[0].ap,
            bid_qty: parseInt(ff.marketFF.marketLevel.bidAskQuote[0].bidQ),
            ask_qty: parseInt(ff.marketFF.marketLevel.bidAskQuote[0].askQ),
            volume: parseInt(ff.marketFF.eFeedDetails.vtt),
            oi_lots: parseInt(ff.marketFF.eFeedDetails.oi),
            oi_change_lots:
              parseInt(ff.marketFF.eFeedDetails.poi) -
              parseInt(ff.marketFF.eFeedDetails.oi),
            greeks: {
              delta: ff.marketFF.optionGreeks.delta,
              gamma: ff.marketFF.optionGreeks.gamma,
              theta: ff.marketFF.optionGreeks.theta,
              vega: ff.marketFF.optionGreeks.vega,
              iv: ff.marketFF.optionGreeks.iv * 100,
              pop: ff.marketFF.optionGreeks.delta * 100,
            },
          }));
        }
        // Price-only update
        else if (data && data.ltpc) {
          setOptionData((prevData) => ({
            ...prevData,
            ltp: data.ltpc.ltp,
            close_price: data.ltpc.cp,
          }));
        }
        // Minimal update
        else if (data && typeof data.ltp !== "undefined") {
          setOptionData((prevData) => ({
            ...prevData,
            ltp: data.ltp,
            volume: data.volume || prevData.volume,
          }));
        }
      }
    });

    return () => {
      if (subscribed) {
        socket.emit("unsubscribe", initialOptionData.instrument_key);
        console.log(
          "[Socket.IO] Unsubscribed from",
          initialOptionData.instrument_key
        );
      }
      socket.disconnect();
    };
  }, [isOpen, initialOptionData?.instrument_key]);

  useEffect(() => {
    setOptionData(initialOptionData);
  }, [initialOptionData]);

  const handleTrade = async (action) => {
    setIsPlacingOrder(true);
    setError(null);

    try {
      const executionPrice =
        action === "buy" ? optionData.ask_price : optionData.bid_price;
      const lotSize = 25;

      const expiryDateTime = new Date(expiry);
      expiryDateTime.setHours(15, 30, 0);

      const newOptionData = {
        symbol: initialOptionData.instrument_key.split("|")[1],
        strikePrice: strikePrice,
        expiryDate: expiryDateTime.toISOString(),
        optionType: optionType.toUpperCase() === "CALL" ? "CE" : "PE",
        lotSize: lotSize,
        ltp: optionData.ltp,
        instrumentExpiryKey: instrumentExpiryKey
      };

      const option = await createOption(newOptionData).unwrap();

      const tradeData = {
        contestId: contestData.contest.id || id,
        optionId: option.option.id,
        action: action,
        quantity: quantity * lotSize,
        price: executionPrice,
        timestamp: new Date(),
      };

      const trade = await createTrade(tradeData).unwrap();
      console.log(trade);
      if (trade.success) {
        const positionData = {
          contestId: contestData.contest.id || id,
          optionId: option.option.id,
          quantity: quantity * lotSize,
          averagePrice: executionPrice,
          direction: action === "buy" ? "long" : "short",
        };

        await createPosition(positionData).unwrap();

        toast.success(
          `Trade Executed: ${action.toUpperCase()} ${quantity} lots @ ₹${executionPrice}`
        );

        onClose();
      }
    } catch (err) {
      console.error("Failed to place trade:", err);

      if (err?.data?.error?.includes("Maximum trades limit")) {
        setTradeLimitReached(true);
        toast.warn(`Trade Limit Reached: ${err.data.maxAllowed} trades used`);
      } else {
        toast.error(`Trade Failed: ${err.error || "Something went wrong"}`);
      }
      setError(err.error || `Failed to place ${action} order`);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleConfirmTrade = () => {
    handleTrade(tradeType);
  };

  if (!optionData) return null;

  const isCall = optionType === "call";
  const priceChange = optionData.ltp - optionData.close_price;
  const priceChangePercent = (priceChange / optionData.close_price) * 100;
  const isPositive = priceChange >= 0;

  const handleTitleClick = () => {
    navigate(
      `/option-details/${id}/${optionData.instrument_key}?type=${optionType}&strike=${strikePrice}`
    );
  };

  const handleBuyClick = () => {
    setTradeType("buy");
    setShowTradeView(true);
  };

  const handleSellClick = () => {
    setTradeType("sell");
    setShowTradeView(true);
  };

  const handleBack = () => {
    setShowTradeView(false);
    setTradeType(null);
    setQuantity(1);
  };

  const lotSize = 25;
  const marketPrice =
    tradeType === "buy"
      ? optionData.ltp?.toFixed(2)
      : optionData.ltp?.toFixed(2);
  const totalValue = quantity * lotSize * marketPrice;

  const increaseQuantity = () => setQuantity((prev) => prev + 1);
  const decreaseQuantity = () =>
    setQuantity((prev) => (prev > 1 ? prev - 1 : 1));

  // Connection status indicator
  const ConnectionStatus = () => (
    <div
      className={`flex items-center gap-1 text-xs ${
        isConnected ? "text-green-600" : "text-red-600"
      }`}
    >
      {isConnected ? (
        <Wifi className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}
      <span className="hidden sm:inline">
        {isConnected ? "Live" : "Offline"}
      </span>
    </div>
  );

  function isMarketOpen() {
    const now = new Date();
    const open = new Date(now);
    open.setHours(9, 15, 0, 0); // 9:15 AM
    const close = new Date(now);
    close.setHours(15, 30, 0, 0); // 3:30 PM
    return now >= open && now <= close;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={`
          ${
            isMobile
              ? "h-[85vh] w-full rounded-t-3xl border-0 shadow-2xl"
              : "w-[480px] max-w-full rounded-l-3xl border-0 shadow-2xl"
          } 
          overflow-y-auto p-0
        `}
      >
        {/* Header */}
        <SheetHeader className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 p-4 sm:p-6 border-b">
          <SheetTitle className="flex items-center justify-between text-base sm:text-lg">
            {showTradeView ? (
              <div className="flex items-center gap-2 sm:gap-3 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="p-2 hover:bg-slate-100 rounded-full shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl font-bold truncate">
                      {strikePrice}
                    </span>
                    <Badge
                      variant={isCall ? "default" : "destructive"}
                      className={`${
                        isCall
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-red-100 text-red-800 hover:bg-red-200"
                      } font-medium text-xs`}
                    >
                      {isCall ? "CE" : "PE"}
                    </Badge>
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground truncate">
                    {tradeType === "buy" ? "Buy Order" : "Sell Order"}
                  </span>
                </div>
              </div>
            ) : (
              // <button
              //   type="button"
              //   // onClick={handleTitleClick}
              //   className="flex items-center gap-2 sm:gap-3 focus:outline-none hover:bg-slate-100 rounded-lg px-1 py-0.5 transition  min-w-0"
              //   title="Go to Option Details"
              // >
              <div className="flex items-start justify-start gap-2 sm:gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <div className=" flex items-start">
                    <span className="text-xs sm:text-sm text-muted-foreground truncate">
                      {optionData.symbol || ""}
                    </span>
                    <br />
                    <span className="text-lg sm:text-xl font-bold truncate">
                      {strikePrice}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isCall ? "default" : "destructive"}
                      className={`${
                        isCall
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-red-100 text-red-800 hover:bg-red-200"
                      } font-medium text-xs`}
                    >
                      {isCall ? "CE" : "PE"}
                    </Badge>
                    <MoveUpRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
                  </div>
                </div>
              </div>
              // </button>
            )}

            {/* Right side - Price and Status */}
            <div className="flex  items-end gap-1 shrink-0">
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-lg sm:text-xl font-bold text-slate-900">
                    ₹{optionData.ltp?.toFixed(2)}
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      isPositive
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline">
                      {isPositive ? "+" : ""}
                      {priceChange?.toFixed(2)}
                    </span>
                    <span>({priceChangePercent?.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(expiry).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </Badge>
                <ConnectionStatus />
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {showTradeView ? (
            // Trade View
            <div className="space-y-4 sm:space-y-6">
              {/* Market Price Card */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-4 sm:p-6">
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-1">
                    Market Price
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                    ₹{optionData.ltp?.toFixed(2)}
                  </div>
                  <div
                    className={`text-sm mt-1 ${
                      tradeType === "buy" ? "text-orange-600" : "text-blue-600"
                    }`}
                  >
                    {tradeType === "buy" ? "Ask Price" : "Bid Price"}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Lot Size Info */}
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">
                    Lot Size
                  </span>
                  <span className="text-lg font-bold">{lotSize}</span>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-slate-700">
                    Number of Lots
                  </span>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={decreaseQuantity}
                    className="w-10 h-10 rounded-full p-0"
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <div className="text-xl sm:text-2xl font-bold w-16 text-center">
                    {quantity}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={increaseQuantity}
                    className="w-10 h-10 rounded-full p-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="text-center text-sm text-slate-600 mt-2">
                  Total Quantity: {(quantity * lotSize).toLocaleString()}
                </div>
              </div>

              {/* Total Value */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">
                    Total Value
                  </span>
                  <span className="text-xl font-bold text-slate-900">
                    ₹{totalValue?.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1 text-right">
                  {quantity} × {lotSize} × ₹{optionData.ltp?.toFixed(2)}
                </div>
              </div>

              {/* Confirm Button */}
              <Button
                onClick={handleConfirmTrade}
                className={`w-full font-semibold py-4 rounded-xl shadow-lg text-base sm:text-lg ${
                  tradeType === "buy"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
                disabled={isLoading || isPlacingOrder || !isConnected}
              >
                {isPlacingOrder ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-white"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : tradeType === "buy" ? (
                  <>
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Confirm Buy
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-5 h-5 mr-2" />
                    Confirm Sell
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Main View
            <>
              {/* Market Depth */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-blue-700">
                      Bid
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-blue-900">
                    ₹{optionData.bid_price?.toFixed(2)}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Qty: {optionData.bid_qty?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 sm:p-4 border border-orange-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-sm font-medium text-orange-700">
                      Ask
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-orange-900">
                    ₹{optionData.ask_price?.toFixed(2)}
                  </div>
                  <div className="text-xs text-orange-600 mt-1">
                    Qty: {optionData.ask_qty?.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">
                      Open Interest
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-bold">
                    {optionData.oi_lots?.toLocaleString()}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      optionData.oi_change_lots >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {optionData.oi_change_lots >= 0 ? "+" : ""}
                    {optionData.oi_change_lots?.toLocaleString()} lots
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">
                      Volume
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-bold">
                    {optionData.volume?.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Today's Volume
                  </div>
                </div>
              </div>

              {/* Greeks */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold mb-3 text-slate-800">
                  Greeks & IV
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Delta</span>
                      <span className="font-medium">
                        {optionData.greeks?.delta?.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Gamma</span>
                      <span className="font-medium">
                        {optionData.greeks?.gamma?.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">IV</span>
                      <span className="font-medium">
                        {optionData.greeks?.iv?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Theta</span>
                      <span className="font-medium">
                        {optionData.greeks?.theta?.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Vega</span>
                      <span className="font-medium">
                        {optionData.greeks?.vega?.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">PoP</span>
                      <span className="font-medium">
                        {optionData.greeks?.pop?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2 sticky bottom-0 bg-white pb-2">
                <Button
                  onClick={handleBuyClick}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 sm:py-4 rounded-xl shadow-lg"
                //  disabled={isLoading || !isConnected || !isMarketOpen()}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Buy
                </Button>
                <Button
                  onClick={handleSellClick}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 sm:py-4 rounded-xl shadow-lg"
                  disabled={isLoading || !isConnected || !isMarketOpen()}
                >
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Sell
                </Button>
              </div>

              {/* Market Closed Message */}
              {!isMarketOpen() && (
                <div className="text-center text-xs text-red-600 mt-2">
                  Market is closed. Trading allowed from 9:15 AM to 3:30 PM.
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
