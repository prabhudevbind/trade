"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function DesktopOptionChain({
  data,
  onOptionClick,
  formatPrice,
  formatOI,
  atmStrike,
  calculatePriceChange,
  disabled = false,
}) {
  const [viewMode, setViewMode] = useState("ltp") // "ltp" or "greeks"

  return (
    <div className="hidden md:block bg-slate-900 rounded-lg overflow-hidden">
      {/* Header with Toggle */}
      <div className="bg-slate-800 p-4 border-b border-slate-700">
        <div className="flex items-center justify-center gap-0">
          <Button
            variant={viewMode === "ltp" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("ltp")}
            disabled={disabled}
            className={`rounded-r-none ${
              viewMode === "ltp"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-slate-700 hover:bg-slate-600 text-slate-300"
            }`}
          >
            LTP & OI
          </Button>
          <Button
            variant={viewMode === "greeks" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("greeks")}
            disabled={disabled}
            className={`rounded-l-none ${
              viewMode === "greeks"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-slate-700 hover:bg-slate-600 text-slate-300"
            }`}
          >
            Greeks
          </Button>
        </div>
      </div>

      {/* Column Headers */}
      {viewMode === "ltp" ? (
        <div className="grid grid-cols-9 text-xs font-medium text-slate-400 py-3 px-4 bg-slate-800 border-b border-slate-700">
          <div className="text-center">
            Call OI
            <br />
            (Chg %)
          </div>
          <div className="text-center">
            Call LTP
            <br />
            (Chg %)
          </div>
          <div className="text-center">
            Strike
            <br />
            Price
          </div>
          <div className="text-center">
            Put LTP
            <br />
            (Chg %)
          </div>
          <div className="text-center">
            Put OI
            <br />
            (Chg %)
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 text-xs font-medium text-slate-400 py-3 px-4 bg-slate-800 border-b border-slate-700">
          <div className="text-center">Strike</div>
          <div className="text-center">C Δ</div>
          <div className="text-center">IV</div>
          <div className="text-center">P Δ</div>
          <div className="text-center">Vega</div>
          <div className="text-center">Theta</div>
          <div className="text-center">Gamma</div>
        </div>
      )}

      {/* Disabled Overlay */}
      {disabled && (
        <div className="relative">
          <div className="absolute inset-0 bg-slate-900/80 z-10 flex items-center justify-center">
            <div className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Join a contest to interact with options
            </div>
          </div>
        </div>
      )}

      {/* Options Data */}
      <div className="max-h-96 overflow-y-auto">
        {data?.option_chain?.map((strikeData, index) => {
          const isATM = strikeData.strike_price === atmStrike
          const callChange = calculatePriceChange(strikeData.call_option?.ltp, strikeData.call_option?.close_price)
          const putChange = calculatePriceChange(strikeData.put_option?.ltp, strikeData.put_option?.close_price)

          if (viewMode === "ltp") {
            return (
              <div
                key={index}
                className={`grid grid-cols-5 text-xs border-b border-slate-700 py-3 px-4 hover:bg-slate-800/50 transition-colors ${
                  isATM ? "bg-yellow-900/30 border-yellow-600/50" : "bg-slate-900"
                }`}
              >
                {/* Call OI */}
                <div className="text-center space-y-1">
                  <div className="text-slate-300 font-medium">{formatOI(strikeData.call_option?.oi_lots || 0)}</div>
                  <div className="text-green-400 text-xs">+2.31%</div>
                </div>

                {/* Call LTP */}
                <div
                  className={`text-center space-y-1 ${!disabled ? "cursor-pointer hover:bg-slate-700/50 p-2 rounded" : ""}`}
                  onClick={() => !disabled && onOptionClick(strikeData, "call")}
                >
                  <div className="text-slate-300 font-semibold">
                    {formatPrice(strikeData.call_option?.ltp || 0).replace("₹", "")}
                  </div>
                  <div className={`text-xs ${callChange.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {callChange.change >= 0 ? "+" : ""}
                    {callChange.changePercent}%
                  </div>
                </div>

                {/* Strike Price */}
                <div className="text-center flex items-center justify-center">
                  <Badge
                    variant={isATM ? "default" : "outline"}
                    className={`text-xs font-bold ${
                      isATM
                        ? "bg-yellow-600 text-white border-yellow-500"
                        : "bg-slate-800 text-slate-300 border-slate-600"
                    }`}
                  >
                    {strikeData.strike_price.toLocaleString()}
                  </Badge>
                </div>

                {/* Put LTP */}
                <div
                  className={`text-center space-y-1 ${!disabled ? "cursor-pointer hover:bg-slate-700/50 p-2 rounded" : ""}`}
                  onClick={() => !disabled && onOptionClick(strikeData, "put")}
                >
                  <div className="text-slate-300 font-semibold">
                    {formatPrice(strikeData.put_option?.ltp || 0).replace("₹", "")}
                  </div>
                  <div className={`text-xs ${putChange.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {putChange.change >= 0 ? "+" : ""}
                    {putChange.changePercent}%
                  </div>
                </div>

                {/* Put OI */}
                <div className="text-center space-y-1">
                  <div className="text-slate-300 font-medium">{formatOI(strikeData.put_option?.oi_lots || 0)}</div>
                  <div className="text-green-400 text-xs">+215.62%</div>
                </div>
              </div>
            )
          } else {
            // Greeks view
            return (
              <div
                key={index}
                className={`grid grid-cols-7 text-xs border-b border-slate-700 py-3 px-4 hover:bg-slate-800/50 transition-colors ${
                  isATM ? "bg-yellow-900/30 border-yellow-600/50" : "bg-slate-900"
                }`}
              >
                {/* Strike */}
                <div className="text-center">
                  <Badge
                    variant={isATM ? "default" : "outline"}
                    className={`text-xs font-bold ${
                      isATM
                        ? "bg-yellow-600 text-white border-yellow-500"
                        : "bg-slate-800 text-slate-300 border-slate-600"
                    }`}
                  >
                    {strikeData.strike_price.toLocaleString()}
                  </Badge>
                </div>

                {/* Call Delta */}
                <div className="text-center text-slate-300 font-medium">
                  {(strikeData.call_option?.greeks?.delta || 0).toFixed(2)}
                </div>

                {/* IV */}
                <div className="text-center text-slate-300 font-medium">
                  {(strikeData.call_option?.greeks?.iv || 0).toFixed(2)}
                </div>

                {/* Put Delta */}
                <div className="text-center text-slate-300 font-medium">
                  {(strikeData.put_option?.greeks?.delta || 0).toFixed(2)}
                </div>

                {/* Vega */}
                <div className="text-center text-slate-300 font-medium">
                  {(strikeData.call_option?.greeks?.vega || 0).toFixed(2)}
                </div>

                {/* Theta */}
                <div className="text-center text-slate-300 font-medium">
                  {(strikeData.call_option?.greeks?.theta || 0).toFixed(2)}
                </div>

                {/* Gamma */}
                <div className="text-center text-slate-300 font-medium">
                  {(strikeData.call_option?.greeks?.gamma || 0).toFixed(2)}
                </div>
              </div>
            )
          }
        })}
      </div>

      {/* Footer Note for Greeks */}
      {viewMode === "greeks" && (
        <div className="bg-slate-800 p-3 text-xs text-slate-400 border-t border-slate-700">
          <strong>Note:</strong> Greeks and IV data on expiry dates may be shown as 0
        </div>
      )}
    </div>
  )
}

// Helper Components
function PriceChange({ change }) {
  return (
    <div className="space-y-1">
      <div className={`font-medium ${change.change > 0 ? "text-green-400" : "text-red-400"}`}>
        {change.change > 0 ? "+" : ""}
        {change.change}
      </div>
      <div className={`text-xs ${change.changePercent > 0 ? "text-green-400" : "text-red-400"}`}>
        ({change.changePercent}%)
      </div>
    </div>
  )
}

function GreeksInfo({ data }) {
  return (
    <div className="space-y-1">
      <div className="font-medium text-slate-300">{(data?.iv || 0).toFixed(1)}%</div>
      <div className="text-xs text-slate-400">Δ: {(data?.delta || 0).toFixed(2)}</div>
    </div>
  )
}
