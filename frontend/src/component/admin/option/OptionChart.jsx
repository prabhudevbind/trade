"use client";

import { useState, useEffect } from "react";
import { Calendar, BarChart3 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useGetOptionsQuery } from "@/store/api/options.api";// Import the RTK Query hook

const OptionChain = () => {
  const [selectedIndex, setSelectedIndex] = useState("NSE_INDEX|Nifty Bank");
  const [selectedExpiry, setSelectedExpiry] = useState("2025-05-29");
  const [optionChainRows, setOptionChainRows] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch initial option chain data using RTK Query
  const { data: initialData, error: queryError, isLoading: queryLoading } = useGetOptionsQuery({
    expiry_date: selectedExpiry,
    instrument_key: selectedIndex,
  });

  // Process data into rows for the option chain
  const processOptionData = (optionData) => {
    if (!optionData?.success || !optionData?.data?.length) {
      setError(optionData?.message || "No option chain data available");
      setIsLoading(false);
      return;
    }

    const strikePrices = [...new Set(optionData.data.map((option) => option.strike_price))].sort(
      (a, b) => a - b
    );

    const rows = strikePrices.map((strikePrice) => {
      const callOption = optionData.data.find(
        (option) => option.strike_price === strikePrice && option.instrument_type === "CE"
      );
      const putOption = optionData.data.find(
        (option) => option.strike_price === strikePrice && option.instrument_type === "PE"
      );

      return {
        strikePrice,
        call: callOption || null,
        put: putOption || null,
        callOI: Math.floor(Math.random() * 100000), // Placeholder; replace with actual OI if available
        callPrice: callOption ? Number.parseFloat((Math.random() * 1000).toFixed(2)) : 0,
        callChange: Number.parseFloat((Math.random() * 100 - 50).toFixed(2)),
        callChangePercent: Number.parseFloat((Math.random() * 20 - 10).toFixed(2)),
        putOI: Math.floor(Math.random() * 100000),
        putPrice: putOption ? Number.parseFloat((Math.random() * 1000).toFixed(2)) : 0,
        putChange: Number.parseFloat((Math.random() * 100 - 50).toFixed(2)),
        putChangePercent: Number.parseFloat((Math.random() * 20 - 10).toFixed(2)),
      };
    });

    setOptionChainRows(rows);
    setIsLoading(false);
    setError(null);
  };

  // Handle initial data from RTK Query
  useEffect(() => {
    if (queryLoading) {
      setIsLoading(true);
    } else if (queryError) {
      setError(queryError?.data?.message || "Error fetching initial option chain data");
      setIsLoading(false);
    } else if (initialData) {
      processOptionData(initialData);
    }
  }, [initialData, queryError, queryLoading]);

  // Set up EventSource for 1-second streaming updates
  useEffect(() => {
    const eventSource = new EventSource(
      `/api/v1/option-chain-stream?instrument_key=${encodeURIComponent(
        selectedIndex
      )}&expiry_date=${selectedExpiry}`
    );

    eventSource.onmessage = (event) => {
      const optionData = JSON.parse(event.data);
      processOptionData(optionData);
    };

    eventSource.onerror = (e) => {
      console.error("SSE Error:", e);
      setError("Connection to data stream lost. Trying to reconnect...");
      // EventSource automatically attempts to reconnect
    };

    // Cleanup on component unmount or when dependencies change
    return () => {
      eventSource.close();
    };
  }, [selectedIndex, selectedExpiry]);

  const handleOptionClick = (option, type) => {
    if (!option) return;
    navigate(`/option-details/${option.instrument_key}?type=${type}`);
  };

  const formatPrice = (price) => {
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
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(oi);
  };

  return (
    <div className="grid grid-cols-8 mx-auto px-2 py-4">
      <div className="col-span-6 justify-center items-center">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="sticky top-0 bg-background z-10 border-b">
            <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground py-2">
              <div className="text-center">OI (lots)</div>
              <div className="text-center">CALL PRICE</div>
              <div className="text-center">STRIKE</div>
              <div className="text-center">PUT PRICE</div>
              <div className="text-center">OI (lots)</div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <Skeleton key={j} className="h-10 w-full" />
                  ))}
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">{error}</div>
          ) : (
            <div className="space-y-1 py-2">
              {optionChainRows.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-5 text-xs border-b border-muted py-2"
                >
                  <div className="text-center">
                    <div>{formatOI(row.callOI || 0)}</div>
                    <div
                      className={row.callChangePercent > 0 ? "text-green-500" : "text-red-500"}
                    >
                      {row.callChangePercent > 0 ? "+" : ""}
                      {row.callChangePercent}%
                    </div>
                  </div>

                  <div
                    className="text-center cursor-pointer hover:bg-muted p-1 rounded"
                    onClick={() => handleOptionClick(row.call, "call")}
                  >
                    <div className="font-medium">{formatPrice(row.callPrice || 0)}</div>
                    <div className={row.callChange > 0 ? "text-green-500" : "text-red-500"}>
                      {row.callChange > 0 ? "+" : ""}
                      {row.callChange} ({Math.abs(row.callChangePercent || 0)}%)
                    </div>
                  </div>

                  <div className="text-center font-bold flex items-center justify-center">
                    <div className="bg-muted px-2 py-1 rounded-md">
                      {row.strikePrice.toLocaleString()}
                    </div>
                  </div>

                  <div
                    className="text-center cursor-pointer hover:bg-muted p-1 rounded"
                    onClick={() => handleOptionClick(row.put, "put")}
                  >
                    <div className="font-medium">{formatPrice(row.putPrice || 0)}</div>
                    <div className={row.putChange > 0 ? "text-green-500" : "text-red-500"}>
                      {row.putChange > 0 ? "+" : ""}
                      {row.putChange} ({Math.abs(row.putChangePercent || 0)}%)
                    </div>
                  </div>

                  <div className="text-center">
                    <div>{formatOI(row.putOI || 0)}</div>
                    <div
                      className={row.putChangePercent > 0 ? "text-green-500" : "text-red-500"}
                    >
                      {row.putChangePercent > 0 ? "+" : ""}
                      {row.putChangePercent}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 col-span-2 h-full items-center bg-muted/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recommended Order</h3>
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          <p><strong>Instrument:</strong> BANKNIFTY 40500 CE</p>
          <p><strong>Action:</strong> Buy</p>
          <p><strong>Price:</strong> ₹450.25</p>
          <p><strong>Quantity:</strong> 30 lots</p>
          <p><strong>Stop Loss:</strong> ₹400.00</p>
          <p><strong>Target:</strong> ₹500.00</p>
          <p><strong>Rationale:</strong> Bullish trend detected based on recent OI and price movements.</p>
        </div>
        <Button className="w-full mt-4">Place Order</Button>
      </div>
    </div>
  );
};

export default OptionChain;