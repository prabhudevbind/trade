"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Activity, BarChart3, Clock, MoveUpRight, ArrowLeft, Plus, Minus } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { useState, useEffect } from "react"
import { toast } from "react-toastify"
import {
  useCreateOptionMutation,
  useCreatePositionMutation,
  useCreateTradeMutation,
} from "@/store/api/contest"

// Remove custom hook, use Tailwind CSS classes for responsive drawer

export function OptionDetailsDrawer({
  isOpen,
  onClose,
  optionData: initialOptionData,
  strikePrice,
  optionType,
  expiry,
  contestData={
    "id": 31,
    "user_id": 5,
    "contest_id": 2,
    "virtual_cash": "100000",
    "joined_at": "2025-06-16T07:13:38.344Z",
    "contest": {
        "id": 2,
        "name": "AJAY TRADING COMPANY",
        "start_time": "2025-05-12T18:48:00.000Z",
        "end_time": "2025-06-26T08:52:00.000Z",
        "maxTrade": "6",
        "entry_fee": "55",
        "status": "ongoing",
        "trading_instrument": "BOTH",
        "created_at": "2025-05-20T10:18:37.018Z",
        "updated_at": "2025-06-16T06:54:14.902Z"
    }
},
  underlyingPrice,
  onBuy,
  onSell,
  isLoading,
}) {
  const [showTradeView, setShowTradeView] = useState(false)
  const [tradeType, setTradeType] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [optionData, setOptionData] = useState(initialOptionData)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [error, setError] = useState(null)
  const [tradeLimitReached, setTradeLimitReached] = useState(false)
  
  const navigate = useNavigate()
  const { id } = useParams()
  
  console.log("Contest Data:", contestData)
  const [createOption] = useCreateOptionMutation()
  const [createPosition] = useCreatePositionMutation()
  const [createTrade] = useCreateTradeMutation()

  useEffect(() => {
    if (!isOpen || !initialOptionData?.instrument_key) return;

    // Create SSE connection for real-time updates
    const eventSource = new EventSource(`http://localhost:5001/stream/${initialOptionData.instrument_key}`);

    eventSource.onmessage = (event) => {
      const { instrumentKey, data } = JSON.parse(event.data);
      if (instrumentKey === initialOptionData.instrument_key) {
        const ff = data.ff;
        const ltpc = ff.marketFF.ltpc;
        const marketLevel = ff.marketFF.marketLevel;
        const greeks = ff.marketFF.optionGreeks;
        const eFeedDetails = ff.marketFF.eFeedDetails;

        setOptionData(prevData => ({
          ...prevData,
          ltp: ltpc.ltp,
          close_price: eFeedDetails.cp,
          bid_price: marketLevel.bidAskQuote[0].bp,
          ask_price: marketLevel.bidAskQuote[0].ap,
          bid_qty: parseInt(marketLevel.bidAskQuote[0].bidQ),
          ask_qty: parseInt(marketLevel.bidAskQuote[0].askQ),
          volume: parseInt(eFeedDetails.vtt),
          oi_lots: parseInt(eFeedDetails.oi),
          oi_change_lots: parseInt(eFeedDetails.poi) - parseInt(eFeedDetails.oi),
          greeks: {
            delta: greeks.delta,
            gamma: greeks.gamma,
            theta: greeks.theta,
            vega: greeks.vega,
            iv: greeks.iv * 100, // Convert to percentage
            pop: greeks.delta * 100 // Probability of profit approximation
          }
        }));
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isOpen, initialOptionData?.instrument_key]);

  useEffect(() => {
    setOptionData(initialOptionData);
  }, [initialOptionData]);

  const handleTrade = async (action) => {
    setIsPlacingOrder(true)
    setError(null)

    try {
      // Get the execution price based on action
      const executionPrice = action === 'buy' ? initialOptionData.ask_price : initialOptionData.bid_price
      const lotSize = 25 // Default lot size, can be made dynamic

      // Create option record
      // Format the expiry date to ISO string with time
      const expiryDateTime = new Date(expiry);
      expiryDateTime.setHours(15, 30, 0); // Set to market closing time (3:30 PM)

      const newOptionData = {
        symbol: initialOptionData.instrument_key.split("|")[1],
        strikePrice: strikePrice,
        expiryDate: expiryDateTime.toISOString(), // Send as ISO string
        optionType: optionType.toUpperCase() === 'CALL' ? 'CE' : 'PE', // Normalize option type
        lotSize: lotSize,
        ltp: initialOptionData.ltp,
      }

      const option = await createOption(newOptionData).unwrap()

      // Create trade record
      const tradeData = {
        contestId: contestData.contest.id || id,
        optionId: option.option.id,
        action: action,
        quantity: quantity * lotSize, // Total quantity (lots × lot size)
        price: executionPrice,
        timestamp: new Date(),
      }

      const trade = await createTrade(tradeData).unwrap()

      // If successful, create a position
      const positionData = {
        contestId: contestData.contest_id,
        optionId: option.option.id,
        quantity: quantity * lotSize,
        averagePrice: executionPrice,
        direction: action === 'buy' ? 'long' : 'short',
      }

      await createPosition(positionData).unwrap()

      // Show success message
      toast({
        title: "Trade Executed Successfully",
        description: `${action.toUpperCase()} ${quantity} lots of ${strikePrice} ${optionType.toUpperCase()} @ ₹${executionPrice}`,
        variant: "success",
      })

      // Close the drawer
      onClose()

    } catch (err) {
      console.error("Failed to place trade:", err)

      if (err?.data?.error?.includes("Maximum trades limit")) {
        setTradeLimitReached(true)
        toast({
          title: "Trade Limit Reached",
          description: `You've used all ${err.data.maxAllowed} allowed trades for this contest.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Trade Failed",
          description: err.error || "Something went wrong",
          variant: "destructive",
        })
      }
      setError(err.error || `Failed to place ${action} order`)
    } finally {
      setIsPlacingOrder(false)
    }
  }

  const handleConfirmTrade = () => {
    handleTrade(tradeType)
  }

  if (!optionData) return null

  const isCall = optionType === "call"
  const priceChange = optionData.ltp - optionData.close_price
  const priceChangePercent = (priceChange / optionData.close_price) * 100
  const isPositive = priceChange >= 0

  const handleTitleClick = () => {
    navigate(
      `/option-details/${id}/${optionData.instrument_key}?type=${optionType}&strike=${strikePrice}`
    )
  }

  const handleBuyClick = () => {
    setTradeType('buy')
    setShowTradeView(true)
  }

  const handleSellClick = () => {
    setTradeType('sell')
    setShowTradeView(true)
  }

  const handleBack = () => {
    setShowTradeView(false)
    setTradeType(null)
    setQuantity(1)
  }

  const lotSize = 25 // Default lot size, you can make this dynamic
  const marketPrice = tradeType === 'buy' ? optionData.ask_price : optionData.bid_price
  const totalValue = quantity * lotSize * marketPrice

  const increaseQuantity = () => setQuantity(prev => prev + 1)
  const decreaseQuantity = () => setQuantity(prev => prev > 1 ? prev - 1 : 1)

  // Use Tailwind's responsive classes for SheetContent
  // On desktop (lg:), open right; on mobile, open bottom
  const sheetSide = typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'right' : 'bottom';
  const sheetClass = typeof window !== 'undefined' && window.innerWidth >= 1024
    ? "w-[480px] max-w-full overflow-y-auto border-0 shadow-2xl rounded-l-3xl"
    : "h-[75vh] overflow-y-auto rounded-t-3xl border-0 shadow-2xl";

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side={sheetSide} className={sheetClass}>
        <SheetHeader className="pb-6 border-b">
          <SheetTitle className="flex items-center justify-between text-lg">
            {showTradeView ? (
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleBack}
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{strikePrice}</span>
                    <Badge
                      variant={isCall ? "default" : "destructive"}
                      className={`${isCall ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"} font-medium`}
                    >
                      {isCall ? "CE" : "PE"}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {tradeType === 'buy' ? 'Buy Order' : 'Sell Order'}
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleTitleClick}
                className="flex items-center gap-3 focus:outline-none hover:bg-slate-100 rounded-lg px-1 py-0.5 transition"
                title="Go to Option Details"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{strikePrice}</span>
                    <Badge
                      variant={isCall ? "default" : "destructive"}
                      className={`${isCall ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"} font-medium`}
                    >
                      {isCall ? "CE" : "PE"}
                    </Badge>
                    <MoveUpRight className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {optionData.symbol || "Nifty Bank"}
                  </span>
                </div>
              </button>
            )}
            <div className="text-right">
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {new Date(expiry).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })}
              </Badge>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {showTradeView ? (
            // Trade View
            <div className="space-y-6">
              {/* Market Price */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-6">
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-1">Market Price</div>
                  <div className="text-3xl font-bold text-slate-900">₹{marketPrice.toFixed(2)}</div>
                  <div className={`text-sm mt-1 ${tradeType === 'buy' ? 'text-orange-600' : 'text-blue-600'}`}>
                    {tradeType === 'buy' ? 'Ask Price' : 'Bid Price'}
                  </div>
                </div>
              </div>

              {/* Lot Size */}
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Lot Size</span>
                  <span className="text-lg font-bold">{lotSize}</span>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-slate-700">Number of Lots</span>
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
                  <div className="text-2xl font-bold w-16 text-center">{quantity}</div>
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
                  Total Quantity: {quantity * lotSize}
                </div>
              </div>

              {/* Total Value */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Total Value</span>
                  <span className="text-xl font-bold text-slate-900">₹{totalValue}</span>
                </div>
                <div className="text-xs text-slate-600 mt-1 text-right">
                  {quantity} × {lotSize} × ₹{marketPrice.toFixed(2)}
                </div>
              </div>

              {/* Confirm Button */}
              <Button
                onClick={handleConfirmTrade}
                className={`w-full font-semibold py-4 rounded-xl shadow-lg text-lg ${
                  tradeType === 'buy' 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                disabled={isLoading}
              >
                {tradeType === 'buy' ? (
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
            // Default View
            <>
              {/* Price Section */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-6">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-3xl font-bold text-slate-900">₹{optionData.ltp.toFixed(2)}</div>
                  <div
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {isPositive ? "+" : ""}
                    {priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
                  </div>
                </div>
                <div className="text-sm text-slate-600">Previous Close: ₹{optionData.close_price.toFixed(2)}</div>
              </div>

              {/* Market Depth */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-blue-700">Bid</span>
                  </div>
                  <div className="text-xl font-bold text-blue-900">₹{optionData.bid_price.toFixed(2)}</div>
                  <div className="text-xs text-blue-600 mt-1">Qty: {optionData.bid_qty.toLocaleString()}</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-sm font-medium text-orange-700">Ask</span>
                  </div>
                  <div className="text-xl font-bold text-orange-900">₹{optionData.ask_price.toFixed(2)}</div>
                  <div className="text-xs text-orange-600 mt-1">Qty: {optionData.ask_qty.toLocaleString()}</div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">Open Interest</span>
                  </div>
                  <div className="text-lg font-bold">{optionData.oi_lots.toLocaleString()}</div>
                  <div className={`text-xs mt-1 ${optionData.oi_change_lots >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {optionData.oi_change_lots >= 0 ? "+" : ""}
                    {optionData.oi_change_lots} lots
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">Volume</span>
                  </div>
                  <div className="text-lg font-bold">{optionData.volume.toLocaleString()}</div>
                  <div className="text-xs text-slate-500 mt-1">Today's Volume</div>
                </div>
              </div>

              {/* Greeks */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold mb-3 text-slate-800">Greeks & IV</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Delta</span>
                      <span className="font-medium">{optionData.greeks.delta.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Gamma</span>
                      <span className="font-medium">{optionData.greeks.gamma.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">IV</span>
                      <span className="font-medium">{optionData.greeks.iv.toFixed(2)}%</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Theta</span>
                      <span className="font-medium">{optionData.greeks.theta.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Vega</span>
                      <span className="font-medium">{optionData.greeks.vega.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">PoP</span>
                      <span className="font-medium">{optionData.greeks.pop.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <Button
                  onClick={handleBuyClick}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-lg"
                  disabled={isLoading}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Buy
                </Button>
                <Button
                  onClick={handleSellClick}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow-lg"
                  disabled={isLoading}
                >
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Sell
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}