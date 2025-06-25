"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useEffect, useRef, useState } from "react"
import { OptionDetailsDrawer } from "@/components/OptionDetailsDrawer"
import { TrendingUp, TrendingDown, Target, Lock } from "lucide-react"

export function MobileOptionChain({
  data,
  onOptionClick,
  contestData,
  formatPrice,
  formatOI,
  atmStrike,
  disabled = false,
}) {
  const listRef = useRef(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [selectedStrike, setSelectedStrike] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [viewMode, setViewMode] = useState("ltp") // "ltp" or "greeks"

  useEffect(() => {
    if (atmStrike && listRef.current) {
      const atmElement = document.getElementById(`strike-${atmStrike}`)
      if (atmElement) {
        atmElement.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  }, [atmStrike])

  const handleOptionSelect = (strikeData, type) => {
    if (disabled) return

    const optionData = type === "call" ? strikeData.call_option : strikeData.put_option
    if (optionData) {
      setSelectedOption(optionData)
      setSelectedStrike(strikeData.strike_price)
      setSelectedType(type)
      setIsDrawerOpen(true)
    }
  }

  const getPriceChangeColor = (current, previous) => {
    if (!current || !previous) return "text-slate-400"
    const change = current - previous
    return change >= 0 ? "text-green-400" : "text-red-400"
  }

  const getPriceChangeIcon = (current, previous) => {
    if (!current || !previous) return null
    const change = current - previous
    return change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
  }

  const calculatePriceChangePercent = (current, previous) => {
    if (!current || !previous || previous === 0) return "0.00"
    const change = ((current - previous) / previous) * 100
    return change.toFixed(2)
  }

  return (
    <>
      <div
        className={` bg-slate-900 rounded-lg overflow-hidden ${disabled ? "opacity-60" : ""}`}
        ref={listRef}
      >
        {/* Header with Toggle */}
        <div className="sticky top-0 bg-slate-800 z-20 border-b border-slate-700 p-4">
          {/* View Toggle */}
          <div className="flex items-center justify-start gap-0 mb-4">
            <Button
              variant={viewMode === "ltp" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("ltp")}
              disabled={disabled}
              className={`rounded-r-none text-xs ${
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
              className={`rounded-l-none text-xs ${
                viewMode === "greeks"
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-slate-700 hover:bg-slate-600 text-slate-300"
              }`}
            >
              Greeks
            </Button>
          </div>

          {/* Column Headers */}
          {viewMode === "ltp" ? (
            <div className="grid grid-cols-5 text-xs font-medium text-slate-400 gap-2">
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
            <div className="grid grid-cols-6 text-xs font-medium text-slate-400 gap-1">
              <div className="text-center">Strike</div>
              <div className="text-center">C Δ</div>
              <div className="text-center">IV</div>
              <div className="text-center">P Δ</div>
              <div className="text-center">Vega</div>
              <div className="text-center">Theta</div>
            </div>
          )}
        </div>

        {/* Disabled Overlay Message */}
        {disabled && (
          <div className="sticky top-[140px] z-30 mx-2 mb-2">
            <div className="bg-orange-600 rounded-lg p-3 text-center">
              <Lock className="h-4 w-4 text-white mx-auto mb-1" />
              <p className="text-xs text-white font-medium">Join a contest to interact with options</p>
            </div>
          </div>
        )}

        {/* Options List */}
        <div className="overflow-y-auto max-h-[calc(100vh-12rem)]">
          {data?.option_chain.map((strikeData) => {
            const isATM = strikeData.strike_price === atmStrike
            const callOption = strikeData.call_option
            const putOption = strikeData.put_option

            if (viewMode === "ltp") {
              return (
                <div
                  key={strikeData.strike_price}
                  id={`strike-${strikeData.strike_price}`}
                  className={`grid grid-cols-5 border-b border-slate-700 py-3 px-2 gap-2 ${
                    isATM ? "bg-yellow-900/30 border-yellow-600/50 sticky top-[140px] z-10" : "bg-slate-900"
                  }`}
                >
                  {/* Call OI */}
                  <div className="flex flex-col items-center space-y-1">
                    <div className="text-slate-300 font-medium text-xs">{formatOI(callOption?.oi_lots || 0)}</div>
                    <div className="text-green-400 text-[10px]">+2.31%</div>
                  </div>

                  {/* Call LTP */}
                  <div
                    className={`flex flex-col items-center space-y-1 ${
                      disabled ? "cursor-not-allowed" : "active:bg-slate-700/50 cursor-pointer p-2 rounded"
                    }`}
                    onClick={() => handleOptionSelect(strikeData, "call")}
                  >
                    {callOption ? (
                      <>
                        <div className="text-slate-300 font-semibold text-xs">{callOption.ltp.toFixed(2)}</div>
                        <div className={`text-[10px] ${getPriceChangeColor(callOption.ltp, callOption.close_price)}`}>
                          {calculatePriceChangePercent(callOption.ltp, callOption.close_price) >= 0 ? "-" : ""}
                          {calculatePriceChangePercent(callOption.ltp, callOption.close_price)}%
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500 text-xs">-</span>
                    )}
                  </div>

                  {/* Strike Price */}
                  <div className="flex items-center justify-center">
                    <Badge
                      variant={isATM ? "default" : "outline"}
                      className={`text-xs font-bold ${
                        isATM
                          ? "bg-yellow-600 text-white border-yellow-500"
                          : "bg-slate-800 text-slate-300 border-slate-600"
                      }`}
                    >
                      {isATM && <Target className="w-3 h-3 mr-1" />}
                      {strikeData.strike_price.toLocaleString()}
                    </Badge>
                  </div>

                  {/* Put LTP */}
                  <div
                    className={`flex flex-col items-center space-y-1 ${
                      disabled ? "cursor-not-allowed" : "active:bg-slate-700/50 cursor-pointer p-2 rounded"
                    }`}
                    onClick={() => handleOptionSelect(strikeData, "put")}
                  >
                    {putOption ? (
                      <>
                        <div className="text-slate-300 font-semibold text-xs">{putOption.ltp.toFixed(2)}</div>
                        <div className={`text-[10px] ${getPriceChangeColor(putOption.ltp, putOption.close_price)}`}>
                          {calculatePriceChangePercent(putOption.ltp, putOption.close_price) >= 0 ? "-" : ""}
                          {calculatePriceChangePercent(putOption.ltp, putOption.close_price)}%
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500 text-xs">-</span>
                    )}
                  </div>

                  {/* Put OI */}
                  <div className="flex flex-col items-center space-y-1">
                    <div className="text-slate-300 font-medium text-xs">{formatOI(putOption?.oi_lots || 0)}</div>
                    <div className="text-green-400 text-[10px]">+215.62%</div>
                  </div>
                </div>
              )
            } else {
              // Greeks view
              return (
                <div
                  key={strikeData.strike_price}
                  id={`strike-${strikeData.strike_price}`}
                  className={`grid grid-cols-6 border-b border-slate-700 py-3 px-2 gap-1 ${
                    isATM ? "bg-yellow-900/30 border-yellow-600/50 sticky top-[140px] z-10" : "bg-slate-900"
                  }`}
                >
                  {/* Strike */}
                  <div className="flex items-center justify-center">
                    <Badge
                      variant={isATM ? "default" : "outline"}
                      className={`text-[10px] font-bold px-1 py-0.5 ${
                        isATM
                          ? "bg-yellow-600 text-white border-yellow-500"
                          : "bg-slate-800 text-slate-300 border-slate-600"
                      }`}
                    >
                      {strikeData.strike_price.toLocaleString()}
                    </Badge>
                  </div>

                  {/* Call Delta */}
                  <div className="text-center text-slate-300 font-medium text-xs">
                    {(callOption?.greeks?.delta || 1.0).toFixed(2)}
                  </div>

                  {/* IV */}
                  <div className="text-center text-slate-300 font-medium text-xs">
                    {(callOption?.greeks?.iv || 11.86).toFixed(2)}
                  </div>

                  {/* Put Delta */}
                  <div className="text-center text-slate-300 font-medium text-xs">
                    {(putOption?.greeks?.delta || 0.0).toFixed(2)}
                  </div>

                  {/* Vega */}
                  <div className="text-center text-slate-300 font-medium text-xs">
                    {(callOption?.greeks?.vega || 3.36).toFixed(2)}
                  </div>

                  {/* Theta */}
                  <div className="text-center text-slate-300 font-medium text-xs">
                    {(callOption?.greeks?.theta || -0.5).toFixed(1)}
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

      <OptionDetailsDrawer
        isOpen={isDrawerOpen && !disabled}
        onClose={() => setIsDrawerOpen(false)}
        optionData={selectedOption}
        contestData={contestData}
        strikePrice={selectedStrike}
        optionType={selectedType}
        expiry={data?.option_chain?.[0]?.expiry}
        underlyingPrice={data?.[0]?.underlying_spot_price}
        onBuy={(option) => {
          if (!disabled) {
            onOptionClick(option, "buy")
            setIsDrawerOpen(false)
          }
        }}
        onSell={(option) => {
          if (!disabled) {
            onOptionClick(option, "sell")
            setIsDrawerOpen(false)
          }
        }}
      />
    </>
  )
}
