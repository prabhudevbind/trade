"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, RefreshCw, TrendingUp, TrendingDown } from "lucide-react"
import { AddTradeDialog } from "./components/AddTradeDialog.jsx"

const formatIndianDateTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
}

// Helper function to convert IST timestamp to Unix timestamp for chart
const convertToUnixTimestamp = (istTimestamp) => {
  const date = new Date(istTimestamp);
  return Math.floor(date.getTime() / 1000);
}

export function TradingChart({ instrumentKey, trades, onAddTrade }) {
  const chartContainerRef = useRef(null)
  const chart = useRef(null)
  const lineSeries = useRef(null)
  const volumeSeries = useRef(null)

  const [data, setData] = useState([])
  const [volumeData, setVolumeData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState("intraday")
  const [showVolume, setShowVolume] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showAddTrade, setShowAddTrade] = useState(false)
  const [chartReady, setChartReady] = useState(false)

  const timeframes = {
    intraday: {
      label: "1D",
      interval: "1minute",
      days: 1,
      description: "Intraday 1-minute data",
    },
    week: {
      label: "1W",
      interval: "30minute",
      days: 7,
      description: "Weekly 30-minute data",
    },
    month: {
      label: "1M",
      interval: "day",
      days: 30,
      description: "Monthly daily data",
    },
    quarter: {
      label: "3M",
      interval: "day",
      days: 90,
      description: "Quarterly daily data",
    },
  }

  const formatDate = (date) => {
    return date.toISOString().split("T")[0]
  }

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const getLastTradingDay = (date) => {
    const newDate = new Date(date);
    while (isWeekend(newDate)) {
      newDate.setDate(newDate.getDate() - 1);
    }
    return newDate;
  };

  const getDateRange = (timeframe) => {
    let toDate = new Date();
    toDate = getLastTradingDay(toDate);
    
    let fromDate = new Date(toDate);
    const daysToSubtract = timeframes[timeframe].days;
    let actualDays = 0;
    
    while (actualDays < daysToSubtract) {
      fromDate.setDate(fromDate.getDate() - 1);
      if (!isWeekend(fromDate)) {
        actualDays++;
      }
    }

    return {
      toDate: formatDate(toDate),
      fromDate: formatDate(fromDate),
    }
  }

  const convertToIndianTime = (timestamp) => {
    const date = new Date(timestamp);
    // Convert to Indian time (UTC+5:30)
    const indianTime = new Date(date.getTime());
    return Math.floor(indianTime.getTime() / 1000);
  };

  const fetchHistoricalData = async (selectedTimeframe) => {
    setLoading(true);
    setError(null);
    
    try {
      const { toDate, fromDate } = getDateRange(selectedTimeframe);
      const interval = timeframes[selectedTimeframe].interval;
      const encodedInstrumentKey = encodeURIComponent(instrumentKey);

      const url = `/api/v1/historical-data/${encodedInstrumentKey}/${interval}/${toDate}/${fromDate}`;
      console.log('Fetching data from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('API Response:', responseData);

      if (!responseData.success || !responseData.data?.data?.candles) {
        throw new Error('Invalid API response structure');
      }

      const candles = responseData.data.data.candles;

      if (!Array.isArray(candles) || candles.length === 0) {
        throw new Error('No data available for this timeframe');
      }

      // Create formatted data with proper timestamp handling for Indian market hours
      const formattedData = candles.map(candle => {
        const timestamp = convertToIndianTime(candle[0]);
        
        // Only include data between market hours (9:15 AM to 3:30 PM IST)
        const date = new Date(candle[0]);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const timeInMinutes = hours * 60 + minutes;
        
        // Market hours: 9:15 AM (555 minutes) to 3:30 PM (930 minutes)
        if (timeInMinutes >= 555 && timeInMinutes <= 930) {
          return {
            time: timestamp,
            value: parseFloat(candle[4]), // close price
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4])
          };
        }
        return null;
      }).filter(Boolean); // Remove null values

      // Ensure ascending order by timestamp
      formattedData.sort((a, b) => a.time - b.time);

      // Create volume data with the same time filtering
      const formattedVolumeData = candles.map(candle => {
        const timestamp = convertToIndianTime(candle[0]);
        
        const date = new Date(candle[0]);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const timeInMinutes = hours * 60 + minutes;
        
        if (timeInMinutes >= 555 && timeInMinutes <= 930) {
          return {
            time: timestamp,
            value: parseFloat(candle[5]),
            color: parseFloat(candle[4]) >= parseFloat(candle[1]) ? "#4caf50" : "#f44336"
          };
        }
        return null;
      }).filter(Boolean);

      // Sort volume data in the same order
      formattedVolumeData.sort((a, b) => a.time - b.time);

      // Update chart configuration to show proper time format
      if (chart.current) {
        chart.current.applyOptions({
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: (time) => {
              const date = new Date(time * 1000);
              return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            }
          }
        });
      }

      setData(formattedData);
      setVolumeData(formattedVolumeData);
      setLastUpdated(new Date());
      setError(null);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      setData([]);
      setVolumeData([]);
    } finally {
      setLoading(false);
    }
  }

  // Initialize chart with dynamic import
  useEffect(() => {
    const initChart = async () => {
      try {
        if (!chartContainerRef.current) return;

        // Dynamic import to handle potential issues
        const { createChart, ColorType } = await import("lightweight-charts");
        
        const chartHeight = showVolume ? 600 : 500;

        // Clean up existing chart
        if (chart.current) {
          chart.current.remove();
        }

        chart.current = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "#ffffff" },
            textColor: "#333333",
          },
          width: chartContainerRef.current.clientWidth,
          height: chartHeight,
          grid: {
            vertLines: { color: "#e1e1e1" },
            horzLines: { color: "#e1e1e1" },
          },
          crosshair: { mode: 1 },
          rightPriceScale: {
            borderColor: "#cccccc",
            scaleMargins: {
              top: 0.1,
              bottom: showVolume ? 0.4 : 0.1,
            },
          },
          timeScale: {
            borderColor: "#cccccc",
            timeVisible: true,
            secondsVisible: false,
          },
        });

        lineSeries.current = chart.current.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: '#2962FF',
          crosshairMarkerBackgroundColor: '#ffffff',
          lineType: 1,
        });

        if (showVolume) {
          volumeSeries.current = chart.current.addHistogramSeries({
            color: "#26a69a",
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
            scaleMargins: { top: 0.8, bottom: 0 },
          });
        }

        const handleResize = () => {
          if (chart.current && chartContainerRef.current) {
            chart.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        };

        window.addEventListener("resize", handleResize);
        setChartReady(true);
        console.log('Chart initialized successfully');

        return () => {
          window.removeEventListener("resize", handleResize);
          if (chart.current) {
            chart.current.remove();
          }
        };

      } catch (err) {
        console.error('Error initializing chart:', err);
        setError('Failed to initialize chart: ' + err.message);
      }
    };

    initChart();
  }, [showVolume]);

  // Update chart data
  useEffect(() => {
    if (chartReady && lineSeries.current && data.length > 0) {
      try {
        console.log('Updating chart with data points:', data.length);
        lineSeries.current.setData(data);

        if (volumeSeries.current && volumeData.length > 0) {
          volumeSeries.current.setData(volumeData);
        }

        chart.current.timeScale().fitContent();
        console.log('Chart data updated successfully');
      } catch (err) {
        console.error('Error updating chart data:', err);
        setError('Failed to update chart: ' + err.message);
      }
    }
  }, [data, volumeData, chartReady]);

  // Update trade markers
  useEffect(() => {
    if (chartReady && lineSeries.current && trades.length > 0) {
      const markers = trades.map((trade) => ({
        time: trade.time,
        position: trade.type === "buy" ? "belowBar" : "aboveBar",
        color: trade.type === "buy" ? "#4caf50" : "#f44336",
        shape: trade.type === "buy" ? "circle" : "square",
        text: `${trade.type.toUpperCase()} ${trade.quantity} @ ₹${trade.price}`,
      }));

      lineSeries.current.setMarkers(markers);
    }
  }, [trades, chartReady]);

  // Fetch data when timeframe or instrument changes
  useEffect(() => {
    if (instrumentKey) {
      fetchHistoricalData(timeframe);
    }
  }, [timeframe, instrumentKey]);

  const getCurrentPriceInfo = () => {
    if (data.length === 0) return null;

    const latest = data[data.length - 1];
    const previous = data.length > 1 ? data[data.length - 2] : latest;
    const change = latest.value - previous.value;
    const changePercent = previous.value !== 0 ? (change / previous.value) * 100 : 0;

    return {
      current: latest.value,
      change: change,
      changePercent: changePercent,
      high: Math.max(...data.slice(-20).map(d => d.high || d.value)),
      low: Math.min(...data.slice(-20).map(d => d.low || d.value)),
      volume: volumeData.length > 0 ? volumeData[volumeData.length - 1]?.value : 0,
    };
  };

  const priceInfo = getCurrentPriceInfo();

  return (
    <div className="w-full space-y-6">
      {/* Debug Info */}
     
      {/* Header with Price Info */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">Price Chart</h3>
          <p className="text-sm text-gray-600">Instrument: {instrumentKey}</p>
        </div>

        {priceInfo && (
          <Card className="lg:w-auto">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-2xl font-bold text-gray-800">₹{priceInfo.current.toFixed(2)}</div>
                  <div
                    className={`flex items-center gap-1 text-sm font-medium ${priceInfo.change >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {priceInfo.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {priceInfo.change >= 0 ? "+" : ""}
                    {priceInfo.change.toFixed(2)}({priceInfo.changePercent >= 0 ? "+" : ""}
                    {priceInfo.changePercent.toFixed(2)}%)
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  <div>H: ₹{priceInfo.high.toFixed(2)}</div>
                  <div>L: ₹{priceInfo.low.toFixed(2)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(timeframes).map(([key, config]) => (
            <Button
              key={key}
              variant={timeframe === key ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeframe(key)}
              className="text-xs"
            >
              {config.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={showVolume}
              onChange={(e) => setShowVolume(e.target.checked)}
              className="mr-2"
            />
            Show Volume
          </label>

          <Button variant="outline" size="sm" onClick={() => setShowAddTrade(true)} className="text-xs">
            Add Trade
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHistoricalData(timeframe)}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-3" />
          <span className="text-gray-600">Loading chart data...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-2" />
              <strong>Error:</strong> {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart Container */}
      <div className="relative">
        <div 
          ref={chartContainerRef} 
          className="w-full border rounded-lg" 
          style={{ 
            minHeight: showVolume ? "600px" : "500px",
            background: "#ffffff"
          }} 
        />
        {!chartReady && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <span className="text-gray-600">Initializing chart...</span>
          </div>
        )}
      </div>

      {/* Trade Summary */}
      {trades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trade Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Total Trades</div>
                <div className="text-xl font-semibold">{trades.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Buy Orders</div>
                <div className="text-xl font-semibold text-green-600">
                  {trades.filter((t) => t.type === "buy").length}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Sell Orders</div>
                <div className="text-xl font-semibold text-red-600">
                  {trades.filter((t) => t.type === "sell").length}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Last Updated</div>
                <div className="text-sm">{lastUpdated ? lastUpdated.toLocaleTimeString() : "Never"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Trade Dialog */}
      <AddTradeDialog
        open={showAddTrade}
        onOpenChange={setShowAddTrade}
        onAddTrade={onAddTrade}
        currentPrice={priceInfo?.current || 0}
      />
    </div>
  );
}