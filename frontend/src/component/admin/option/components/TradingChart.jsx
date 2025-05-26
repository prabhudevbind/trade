"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, RefreshCw, TrendingUp, TrendingDown, Play, Pause, ZoomIn, ZoomOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export  function TradingChart({instrumentKey}) {
  const chartContainerRef = useRef(null)
  const chart = useRef(null)
  const lineSeries = useRef(null)
  const volumeSeries = useRef(null)
  const eventSourceRef = useRef(null)

  // Use your original instrument key
  // const instrumentKey = "NSE_FO|58571"

  // Chart and data states
  const [data, setData] = useState([])
  const [volumeData, setVolumeData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState("intraday")
  const [showVolume, setShowVolume] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [chartReady, setChartReady] = useState(false)
  const [isStreamConnected, setIsStreamConnected] = useState(false)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false)

  // Trading states
  const [trades, setTrades] = useState([])
  const [orderQuantity, setOrderQuantity] = useState(30)
  const [orderPrice, setOrderPrice] = useState(0)
  const [orderType, setOrderType] = useState("market")
  const [selectedLotSize, setSelectedLotSize] = useState(30)

  // Real-time market data from your API
  const [marketData, setMarketData] = useState({
    ltp: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    volume: 0,
    oi: 0,
    bidPrice: 0,
    askPrice: 0,
    bidQty: 0,
    askQty: 0,
    cp: 0
  })

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

  const lotSizes = [30, 50, 75, 100, 150, 200]

  const formatDate = (date) => {
    return date.toISOString().split("T")[0]
  }

  const isWeekend = (date) => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  const getLastTradingDay = (date) => {
    const newDate = new Date(date)
    while (isWeekend(newDate)) {
      newDate.setDate(newDate.getDate() - 1)
    }
    return newDate
  }

  const getDateRange = (timeframe) => {
    let toDate = new Date()
    toDate = getLastTradingDay(toDate)
    
    let fromDate = new Date(toDate)
    const daysToSubtract = timeframes[timeframe].days
    let actualDays = 0
    
    while (actualDays < daysToSubtract) {
      fromDate.setDate(fromDate.getDate() - 1)
      if (!isWeekend(fromDate)) {
        actualDays++
      }
    }

    return {
      toDate: formatDate(toDate),
      fromDate: formatDate(fromDate),
    }
  }

  const convertToIndianTime = (timestamp) => {
    const date = new Date(timestamp)
    const indianTime = new Date(date.getTime())
    return Math.floor(indianTime.getTime() / 1000)
  }

  // Your original API fetch function
  const fetchHistoricalData = async (selectedTimeframe) => {
    setLoading(true)
    setError(null)
    
    try {
      const { toDate, fromDate } = getDateRange(selectedTimeframe)
      const interval = timeframes[selectedTimeframe].interval
      const encodedInstrumentKey = encodeURIComponent(instrumentKey)

      const url = `/api/v1/historical-data/${encodedInstrumentKey}/${interval}/${toDate}/${fromDate}`
      console.log('Fetching data from:', url)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData = await response.json()
      console.log('API Response:', responseData)

      if (!responseData.success || !responseData.data?.data?.candles) {
        throw new Error('Invalid API response structure')
      }

      const candles = responseData.data.data.candles

      if (!Array.isArray(candles) || candles.length === 0) {
        throw new Error('No data available for this timeframe')
      }

      // Create formatted data with proper timestamp handling for Indian market hours
      const formattedData = candles.map(candle => {
        const timestamp = convertToIndianTime(candle[0])
        
        // Only include data between market hours (9:15 AM to 3:30 PM IST)
        const date = new Date(candle[0])
        const hours = date.getHours()
        const minutes = date.getMinutes()
        const timeInMinutes = hours * 60 + minutes
        
        // Market hours: 9:15 AM (555 minutes) to 3:30 PM (930 minutes)
        if (timeInMinutes >= 555 && timeInMinutes <= 930) {
          return {
            time: timestamp,
            value: parseFloat(candle[4]), // close price
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4])
          }
        }
        return null
      }).filter(Boolean) // Remove null values

      // Ensure ascending order by timestamp
      formattedData.sort((a, b) => a.time - b.time)

      // Create volume data with the same time filtering
      const formattedVolumeData = candles.map(candle => {
        const timestamp = convertToIndianTime(candle[0])
        
        const date = new Date(candle[0])
        const hours = date.getHours()
        const minutes = date.getMinutes()
        const timeInMinutes = hours * 60 + minutes
        
        if (timeInMinutes >= 555 && timeInMinutes <= 930) {
          return {
            time: timestamp,
            value: parseFloat(candle[5]),
            color: parseFloat(candle[4]) >= parseFloat(candle[1]) ? "#4caf50" : "#f44336"
          }
        }
        return null
      }).filter(Boolean)

      // Sort volume data in the same order
      formattedVolumeData.sort((a, b) => a.time - b.time)

      setData(formattedData)
      setVolumeData(formattedVolumeData)
      
      // Set initial market data from last candle
      if (formattedData.length > 0) {
        const lastCandle = formattedData[formattedData.length - 1]
        setOrderPrice(lastCandle.value)
        
        // Update market data with latest values
        const highPrice = Math.max(...formattedData.slice(-20).map(d => d.high || d.value))
        const lowPrice = Math.min(...formattedData.slice(-20).map(d => d.low || d.value))
        const totalVolume = formattedVolumeData.reduce((sum, vol) => sum + vol.value, 0)
        
        setMarketData(prev => ({
          ...prev,
          ltp: lastCandle.value,
          high: highPrice,
          low: lowPrice,
          volume: totalVolume
        }))
      }
      
      setLastUpdated(new Date())
      setError(null)

    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
      setData([])
      setVolumeData([])
    } finally {
      setLoading(false)
    }
  }

  // Your original real-time update handler
  const handleRealTimeUpdate = (marketDataUpdate) => {
    if (!marketDataUpdate?.data?.ff?.marketFF) return
    
    const { marketFF } = marketDataUpdate.data.ff
    const timestamp = convertToIndianTime(parseInt(marketFF.ltpc.ltt))
    
    // Create new candlestick data point
    const newData = {
      time: timestamp,
      value: parseFloat(marketFF.ltpc.ltp),
      open: parseFloat(marketFF.marketOHLC.ohlc[2].open),
      high: parseFloat(marketFF.marketOHLC.ohlc[2].high),
      low: parseFloat(marketFF.marketOHLC.ohlc[2].low),
      close: parseFloat(marketFF.ltpc.ltp)
    }

    // Create new volume data point
    const newVolumeData = {
      time: timestamp,
      value: parseFloat(marketFF.eFeedDetails.vtt),
      color: marketFF.ltpc.ltp >= marketFF.ltpc.cp ? "#4caf50" : "#f44336"
    }

    // Update chart with new data - PRESERVE ZOOM LEVEL
    if (chartReady && lineSeries.current) {
      // Get current visible range before updating
      const timeScale = chart.current.timeScale()
      const visibleRange = timeScale.getVisibleRange()
      
      lineSeries.current.update(newData)
      if (volumeSeries.current) {
        volumeSeries.current.update(newVolumeData)
      }
      
      // Restore zoom level unless auto-scroll is enabled
      if (!isAutoScrollEnabled && visibleRange) {
        setTimeout(() => {
          timeScale.setVisibleRange(visibleRange)
        }, 50)
      }
    }

    // Update market data state
    setMarketData({
      ltp: parseFloat(marketFF.ltpc.ltp),
      change: parseFloat(marketFF.ltpc.ltp) - parseFloat(marketFF.ltpc.cp),
      changePercent: ((parseFloat(marketFF.ltpc.ltp) - parseFloat(marketFF.ltpc.cp)) / parseFloat(marketFF.ltpc.cp)) * 100,
      high: parseFloat(marketFF.marketOHLC.ohlc[0].high),
      low: parseFloat(marketFF.marketOHLC.ohlc[0].low),
      volume: parseFloat(marketFF.eFeedDetails.vtt),
      oi: parseFloat(marketFF.eFeedDetails.oi),
      bidPrice: marketFF.marketLevel?.bidAskQuote?.[0]?.bp || 0,
      askPrice: marketFF.marketLevel?.bidAskQuote?.[0]?.ap || 0,
      bidQty: marketFF.marketLevel?.bidAskQuote?.[0]?.bq || 0,
      askQty: marketFF.marketLevel?.bidAskQuote?.[0]?.aq || 0,
      cp: parseFloat(marketFF.ltpc.cp)
    })

    // Update order price for market orders
    if (orderType === "market") {
      setOrderPrice(parseFloat(marketFF.ltpc.ltp))
    }

    // Update data arrays
    setData(prevData => {
      const newDataArray = [...prevData]
      const lastIndex = newDataArray.length - 1
      
      if (lastIndex >= 0 && newDataArray[lastIndex].time === timestamp) {
        newDataArray[lastIndex] = newData
      } else {
        newDataArray.push(newData)
      }
      
      return newDataArray
    })

    setVolumeData(prevVolumeData => {
      const newVolumeArray = [...prevVolumeData]
      const lastIndex = newVolumeArray.length - 1
      
      if (lastIndex >= 0 && newVolumeArray[lastIndex].time === timestamp) {
        newVolumeArray[lastIndex] = newVolumeData
      } else {
        newVolumeArray.push(newVolumeData)
      }
      
      return newVolumeArray
    })

    setLastUpdated(new Date())
  }

  // Initialize chart
  useEffect(() => {
    const initChart = async () => {
      try {
        if (!chartContainerRef.current) return

        const { createChart, ColorType } = await import("lightweight-charts")
        
        if (chart.current) {
          chart.current.remove()
        }

        chart.current = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "#ffffff" },
            textColor: "#333333",
          },
          width: chartContainerRef.current.clientWidth,
          height: showVolume ? 600 : 500,
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
            rightOffset: 50,
            tickMarkFormatter: (time) => {
              const date = new Date(time * 1000)
              return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
            }
          },
        })

        lineSeries.current = chart.current.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: '#2962FF',
          crosshairMarkerBackgroundColor: '#ffffff',
          lineType: 1,
        })

        if (showVolume) {
          volumeSeries.current = chart.current.addHistogramSeries({
            color: "#26a69a",
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
            scaleMargins: { top: 0.8, bottom: 0 },
          })
        }

        const handleResize = () => {
          if (chart.current && chartContainerRef.current) {
            chart.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
            })
          }
        }

        window.addEventListener("resize", handleResize)
        setChartReady(true)
        console.log('Chart initialized successfully')

        return () => {
          window.removeEventListener("resize", handleResize)
          if (chart.current) {
            chart.current.remove()
          }
        }

      } catch (err) {
        console.error('Error initializing chart:', err)
        setError('Failed to initialize chart: ' + err.message)
      }
    }

    initChart()
  }, [showVolume])

  // Update chart data while preserving zoom
  useEffect(() => {
    if (chartReady && lineSeries.current && data.length > 0) {
      try {
        console.log('Updating chart with data points:', data.length)
        
        // Get current visible range before updating
        const timeScale = chart.current.timeScale()
        const visibleRange = timeScale.getVisibleRange()
        
        lineSeries.current.setData(data)

        if (volumeSeries.current && volumeData.length > 0) {
          volumeSeries.current.setData(volumeData)
        }

        // Update trade markers
        if (trades.length > 0) {
          const markers = trades.map((trade) => ({
            time: trade.time,
            position: trade.type === "buy" ? "belowBar" : "aboveBar",
            color: trade.type === "buy" ? "#4caf50" : "#f44336",
            shape: trade.type === "buy" ? "circle" : "square",
            text: `${trade.type.toUpperCase()} ${trade.quantity} @ ₹${trade.price}`,
          }))
          lineSeries.current.setMarkers(markers)
        }

        // Restore zoom level or auto-scroll to latest
        if (isAutoScrollEnabled || !visibleRange) {
          timeScale.fitContent()
        } else {
          // Preserve zoom level with a slight delay to ensure data is rendered
          setTimeout(() => {
            if (chart.current && visibleRange) {
              chart.current.timeScale().setVisibleRange(visibleRange)
            }
          }, 100)
        }

        console.log('Chart data updated successfully')
      } catch (err) {
        console.error('Error updating chart data:', err)
        setError('Failed to update chart: ' + err.message)
      }
    }
  }, [data, volumeData, chartReady, trades, isAutoScrollEnabled])

  // Your original data fetching and streaming setup
  useEffect(() => {
    const setupStream = async () => {
      if (!instrumentKey) return

      // First fetch historical data
      await fetchHistoricalData(timeframe)

      // Then set up real-time stream
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      const encodedKey = encodeURIComponent(instrumentKey)
      eventSourceRef.current = new EventSource(`http://localhost:5001/stream/${encodedKey}`)

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleRealTimeUpdate(data)
          setIsStreamConnected(true)
          setError(null)
        } catch (err) {
          console.error('Stream parsing error:', err)
          setError('Failed to parse stream data')
        }
      }

      eventSourceRef.current.onerror = (error) => {
        console.error('Stream connection error:', error)
        setIsStreamConnected(false)
        setError('Stream connection lost. Reconnecting...')
      }

      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          setIsStreamConnected(false)
        }
      }
    }

    setupStream()
  }, [instrumentKey, timeframe])

  // Trading functions
  const placeBuyOrder = () => {
    const price = orderType === "market" ? marketData.ltp : orderPrice
    const newTrade = {
      id: Date.now(),
      time: Math.floor(Date.now() / 1000),
      type: "buy",
      quantity: orderQuantity,
      price: price,
      timestamp: new Date()
    }
    setTrades(prevTrades => [...prevTrades, newTrade])
  }

  const placeSellOrder = () => {
    const price = orderType === "market" ? marketData.ltp : orderPrice
    const newTrade = {
      id: Date.now(),
      time: Math.floor(Date.now() / 1000),
      type: "sell",
      quantity: orderQuantity,
      price: price,
      timestamp: new Date()
    }
    setTrades(prevTrades => [...prevTrades, newTrade])
  }

  const handleLotSizeChange = (lotSize) => {
    setSelectedLotSize(lotSize)
    setOrderQuantity(lotSize)
  }

  // Chart controls
  const zoomIn = () => {
    if (chart.current) {
      const timeScale = chart.current.timeScale()
      const visibleRange = timeScale.getVisibleRange()
      if (visibleRange) {
        const center = (visibleRange.from + visibleRange.to) / 2
        const range = (visibleRange.to - visibleRange.from) * 0.8
        timeScale.setVisibleRange({
          from: center - range / 2,
          to: center + range / 2
        })
      }
    }
  }

  const zoomOut = () => {
    if (chart.current) {
      const timeScale = chart.current.timeScale()
      const visibleRange = timeScale.getVisibleRange()
      if (visibleRange) {
        const center = (visibleRange.from + visibleRange.to) / 2
        const range = (visibleRange.to - visibleRange.from) * 1.2
        timeScale.setVisibleRange({
          from: center - range / 2,
          to: center + range / 2
        })
      }
    }
  }

  const fitContent = () => {
    if (chart.current) {
      chart.current.timeScale().fitContent()
    }
  }

  const toggleAutoScroll = () => {
    setIsAutoScrollEnabled(!isAutoScrollEnabled)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">{instrumentKey}</h1>
            <Badge className={`${isStreamConnected ? 'bg-green-500' : 'bg-red-500'} text-white`}>
              {isStreamConnected ? 'LIVE' : 'DISCONNECTED'}
            </Badge>
          </div>
          <div className="text-sm text-gray-500">
            Last Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "Never"}
          </div>
        </div>

        {/* Market Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">LTP</div>
              <div className="text-xl font-bold">₹{marketData.ltp.toFixed(2)}</div>
              <div className={`text-sm flex items-center gap-1 ${marketData.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {marketData.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {marketData.change >= 0 ? '+' : ''}{marketData.change.toFixed(2)} ({marketData.changePercent >= 0 ? '+' : ''}{marketData.changePercent.toFixed(2)}%)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">High / Low</div>
              <div className="text-lg font-semibold text-green-600">₹{marketData.high.toFixed(2)}</div>
              <div className="text-lg font-semibold text-red-600">₹{marketData.low.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Volume</div>
              <div className="text-lg font-semibold">{(marketData.volume / 1000).toFixed(0)}K</div>
              <div className="text-sm text-gray-500">OI: {(marketData.oi / 1000).toFixed(0)}K</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Bid / Ask</div>
              <div className="text-sm">
                <span className="text-green-600">₹{marketData.bidPrice.toFixed(2)} ({marketData.bidQty})</span>
              </div>
              <div className="text-sm">
                <span className="text-red-600">₹{marketData.askPrice.toFixed(2)} ({marketData.askQty})</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">CP</div>
              <div className="text-lg font-semibold">₹{marketData.cp.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Trades</div>
              <div className="text-lg font-semibold">{trades.length}</div>
              <div className="text-sm text-gray-500">
                Net: {trades.reduce((acc, trade) => 
                  acc + (trade.type === 'buy' ? trade.quantity : -trade.quantity), 0
                )} lots
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Chart Section */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Chart Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-2">
                {Object.entries(timeframes).map(([key, config]) => (
                  <Button
                    key={key}
                    variant={timeframe === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeframe(key)}
                  >
                    {config.label}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={zoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={zoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={fitContent}>
                  Fit
                </Button>
                <Button 
                  variant={isAutoScrollEnabled ? "default" : "outline"} 
                  size="sm" 
                  onClick={toggleAutoScroll}
                >
                  {isAutoScrollEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  Auto
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchHistoricalData(timeframe)}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={showVolume}
                    onChange={(e) => setShowVolume(e.target.checked)}
                    className="mr-2"
                  />
                  Volume
                </label>
              </div>
            </div>

            {/* Chart */}
            <Card>
              <CardContent className="p-0">
                <div 
                  ref={chartContainerRef} 
                  className="w-full" 
                  style={{ 
                    height: showVolume ? "600px" : "500px",
                    background: "#ffffff"
                  }} 
                />
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                    <RefreshCw className="w-6 h-6 animate-spin mr-3" />
                    <span>Loading chart data...</span>
                  </div>
                )}
              </CardContent>
            </Card>

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
          </div>

          {/* Trading Panel */}
          <div className="space-y-4">
            
            {/* Quick Trade Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Trade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Lot Size Selection */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Lot Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    {lotSizes.map((size) => (
                      <Button
                        key={size}
                        variant={selectedLotSize === size ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleLotSizeChange(size)}
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Order Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Order Type</label>
                  <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="market">Market</SelectItem>
                      <SelectItem value="limit">Limit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-sm font
                    medium text-gray-700 block mb-2">Quantity</label>
                  <Input
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(Number(e.target.value))}
                    min={1}
                    className="w-full"
                    placeholder="Enter quantity"
                  />
                </div>
                {/* Price (for limit orders) */}  
                {orderType === "limit" && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Price</label>
                    <Input
                      type="number"
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(Number(e.target.value))}
                      min={0}
                      className="w-full"
                      placeholder="Enter limit price"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    variant="primary" 
                    onClick={placeBuyOrder} 
                    disabled={loading || orderQuantity <= 0}
                  >
                    Buy
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={placeSellOrder} 
                    disabled={loading || orderQuantity <= 0}
                  >
                    Sell
                  </Button>
                </div>
              </CardContent>
            </Card>
            {/* Trade History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trade History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {trades.length === 0 ? (
                  <div className="text-gray-500 text-sm">No trades yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {trades.map((trade) => (
                      <li key={trade.id} className={`flex items-center justify-between p-2 rounded ${trade.type === 'buy' ? 'bg-green-50' : 'bg-red-50'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${trade.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                            {trade.type.toUpperCase()}
                          </span>
                          <span>₹{trade.price.toFixed(2)}</span>
                          <span className="text-sm text-gray-500">{trade.quantity} lots</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>    
    </div>
  )
}
// Note: Ensure you have the necessary CSS styles for the components used in this file.