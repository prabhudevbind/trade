"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Activity, BarChart3, Clock, MoveUpRight } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

export function OptionDetailsDrawer({
  isOpen,
  onClose,
  optionData,
  strikePrice,
  optionType,
  expiry,
  underlyingPrice,
  onBuy,
  onSell,
  isLoading,
}) {
  if (!optionData) return null

  const isCall = optionType === "call"
  const priceChange = optionData.ltp - optionData.close_price
  const priceChangePercent = (priceChange / optionData.close_price) * 100
  const isPositive = priceChange >= 0

  const navigate = useNavigate()
  const { id } = useParams()

  const handleTitleClick = () => {
    navigate(
      `/option-details/${id}/${optionData.instrument_key}?type=${optionType}&strike=${strikePrice}`
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl border-0 shadow-2xl">
        <SheetHeader className="pb-6 border-b">
          <SheetTitle className="flex items-center justify-between text-lg">
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
              onClick={() => onBuy(optionData)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-lg"
              disabled={isLoading}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Buy
            </Button>
            <Button
              onClick={() => onSell(optionData)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow-lg"
              disabled={isLoading}
            >
              <TrendingDown className="w-4 h-4 mr-2" />
              Sell
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
