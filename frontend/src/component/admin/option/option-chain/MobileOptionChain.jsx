"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { OptionDetailsDrawer } from "@/components/OptionDetailsDrawer";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Target,
  Lock,
} from "lucide-react";

export function MobileOptionChain({
  data,
  onOptionClick,
  contestData,
  formatPrice,
  formatOI,
  atmStrike,
  disabled = false,
}) {
  const listRef = useRef(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedStrike, setSelectedStrike] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState("price");

  useEffect(() => {
    if (atmStrike && listRef.current) {
      const atmElement = document.getElementById(`strike-${atmStrike}`);
      if (atmElement) {
        atmElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [atmStrike]);

  const handleOptionSelect = (strikeData, type) => {
    if (disabled) return;
    
    const optionData =
      type === "call" ? strikeData.call_option : strikeData.put_option;
    if (optionData) {
      setSelectedOption(optionData);
      setSelectedStrike(strikeData.strike_price);
      setSelectedType(type);
      setIsDrawerOpen(true);
    }
  };

  const getPriceChangeColor = (current, previous) => {
    if (!current || !previous) return "text-slate-600";
    const change = current - previous;
    return change >= 0 ? "text-green-600" : "text-red-600";
  };

  const getPriceChangeIcon = (current, previous) => {
    if (!current || !previous) return null;
    const change = current - previous;
    return change >= 0 ? (
      <TrendingUp className="w-3 h-3" />
    ) : (
      <TrendingDown className="w-3 h-3" />
    );
  };

  return (
    <>
      <div className={`md:hidden bg-white ${disabled ? 'opacity-60' : ''}`} ref={listRef}>
        {/* Header with Toggle */}
        <div className="sticky top-0 bg-white z-20 border-b border-slate-200">
          {/* View Toggle */}
          <div className="col-span-2 flex items-center justify-center gap-0 bg-slate-50 rounded-md"></div>

          {/* Column Headers */}
          <div className="grid text-xs justify-center items-center grid-cols-4 font-semibold p-3 bg-white border-b">
            <div className="text-center text-green-700">
              {viewMode === "price" ? "Call LTP" : "Call OI"}
            </div>
            <div className="col-span-2 text-center">
              {" "}
              <button
                onClick={() => setViewMode("price")}
                disabled={disabled}
                className={`flex-1 w-16 border text-xs rounded-s-2xl font-medium py-1 transition-colors
                  ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                  ${
                    viewMode === "price"
                      ? "bg-gray-200 text-blue-700 border-blue-400"
                      : "bg-white text-gray-700 border-gray-200"
                  }
                `}
              >
                Price
              </button>
              <button
                onClick={() => setViewMode("oi")}
                disabled={disabled}
                className={`flex-1 w-16 border text-xs rounded-e-2xl font-medium py-1 transition-colors
                  ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                  ${
                    viewMode === "oi"
                      ? "bg-gray-200 text-blue-700 border-blue-400"
                      : "bg-white text-gray-700 border-gray-200"
                  }
                `}
              >
                OI
              </button>
            </div>

            <div className="text-center text-red-700">
              {viewMode === "price" ? "Put LTP" : "Put OI"}
            </div>
          </div>
        </div>

        {/* Disabled Overlay Message */}
        {disabled && (
          <div className="sticky top-[120px] z-30 mx-2 mb-2">
            <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 text-center">
              <Lock className="h-4 w-4 text-orange-600 mx-auto mb-1" />
              <p className="text-xs text-orange-700 font-medium">
                Join a contest to interact with options
              </p>
            </div>
          </div>
        )}

        {/* Options List */}
        <div className="overflow-y-auto max-h-[calc(100vh-12rem)]">
          {data?.option_chain.map((strikeData) => {
            const isATM = strikeData.strike_price === atmStrike;
            const callOption = strikeData.call_option;
            const putOption = strikeData.put_option;

            return (
              <div
                key={strikeData.strike_price}
                id={`strike-${strikeData.strike_price}`}
                className={`grid grid-cols-4 border-b border-slate-100 ${
                  isATM
                    ? "bg-yellow-50 border-yellow-200 sticky top-[120px] z-10"
                    : "bg-white"
                }`}
              >
                {/* Call Side */}
                <div
                  className={`flex flex-col items-center p-3 transition-colors ${
                    disabled 
                      ? 'cursor-not-allowed' 
                      : 'active:bg-green-50 cursor-pointer'
                  }`}
                  onClick={() => handleOptionSelect(strikeData, "call")}
                >
                  {callOption ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-xs">
                          {viewMode === "price"
                            ? `₹${callOption.ltp.toFixed(2)}`
                            : formatOI(callOption.oi_lots)}
                        </span>
                        {viewMode === "price" && (
                          <span
                            className={getPriceChangeColor(
                              callOption.ltp,
                              callOption.close_price
                            )}
                          >
                            {getPriceChangeIcon(
                              callOption.ltp,
                              callOption.close_price
                            )}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 text-center">
                        {viewMode === "price"
                          ? `OI: ${formatOI(callOption.oi_lots)}`
                          : `₹${callOption.ltp.toFixed(2)}`}
                      </div>
                      {viewMode === "price" && callOption.volume > 0 && (
                        <div className="text-[9px] text-green-600 font-medium">
                          Vol: {callOption.volume.toLocaleString()}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </div>

                {/* Strike Price */}
                <div className="col-span-2 flex items-center justify-center p-2">
                  <Badge
                    variant={isATM ? "default" : "outline"}
                    className={`text-xs font-bold px-3 py-1 ${
                      isATM
                        ? "bg-yellow-500 text-white shadow-md"
                        : "bg-white text-slate-700 border-slate-300"
                    }`}
                  >
                    {isATM && <Target className="w-3 h-3 mr-1" />}
                    {strikeData.strike_price.toLocaleString()}
                  </Badge>
                </div>

                {/* Put Side */}
                <div
                  className={`flex flex-col items-center p-3 transition-colors ${
                    disabled 
                      ? 'cursor-not-allowed' 
                      : 'active:bg-red-50 cursor-pointer'
                  }`}
                  onClick={() => handleOptionSelect(strikeData, "put")}
                >
                  {putOption ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-xs">
                          {viewMode === "price"
                            ? `₹${putOption.ltp.toFixed(2)}`
                            : formatOI(putOption.oi_lots)}
                        </span>
                        {viewMode === "price" && (
                          <span
                            className={getPriceChangeColor(
                              putOption.ltp,
                              putOption.close_price
                            )}
                          >
                            {getPriceChangeIcon(
                              putOption.ltp,
                              putOption.close_price
                            )}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 text-center">
                        {viewMode === "price"
                          ? `OI: ${formatOI(putOption.oi_lots)}`
                          : `₹${putOption.ltp.toFixed(2)}`}
                      </div>
                      {viewMode === "price" && putOption.volume > 0 && (
                        <div className="text-[9px] text-red-600 font-medium">
                          Vol: {putOption.volume.toLocaleString()}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
            onOptionClick(option, "buy");
            setIsDrawerOpen(false);
          }
        }}
        onSell={(option) => {
          if (!disabled) {
            onOptionClick(option, "sell");
            setIsDrawerOpen(false);
          }
        }}
      />
    </>
  );
}