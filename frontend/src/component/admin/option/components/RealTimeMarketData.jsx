"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, TrendingUp, TrendingDown, Activity, RefreshCw } from "lucide-react"


export function RealTimeMarketData({ instrumentKey }) {
  const [marketData, setMarketData] = useState(null)
  const [isMarketOpen, setIsMarketOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Check if market is open (9:15 AM to 3:15 PM IST)
  const checkMarketStatus = () => {
    const now = new Date()
    const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    const hours = istTime.getHours()
    const minutes = istTime.getMinutes()
    const currentTime = hours * 60 + minutes

    // Market hours: 9:15 AM (555 minutes) to 3:15 PM (915 minutes)
    const marketOpen = 9 * 60 + 15 // 555 minutes
    const marketClose = 15 * 60 + 15 // 915 minutes

    // Check if it's a weekday (Monday = 1, Sunday = 0)
    const dayOfWeek = istTime.getDay()
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

    return isWeekday && currentTime >= marketOpen && currentTime <= marketClose
  }

  // Generate mock real-time data
  const generateMockMarketData = () => {
    const basePrice = 100 + Math.random() * 50
    const change = (Math.random() - 0.5) * 10
    const open = basePrice - change

    return {
      ltp: basePrice,
      change: change,
      changePercent: (change / open) * 100,
      volume: Math.floor(Math.random() * 1000000) + 100000,
      high: basePrice + Math.random() * 5,
      low: basePrice - Math.random() * 5,
      open: open,
      close: basePrice - 0.5 + Math.random(),
      timestamp: new Date().toISOString(),
    }
  }

  // Fetch real-time market data
  const fetchMarketData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Mock API call - replace with actual Upstox API
      // const response = await fetch(`/api/market-data/${encodeURIComponent(instrumentKey)}`)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      const mockData = generateMockMarketData()
      setMarketData(mockData)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch market data")
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh data during market hours
  useEffect(() => {
    const marketOpen = checkMarketStatus()
    setIsMarketOpen(marketOpen)

    if (marketOpen) {
      // Initial fetch
      fetchMarketData()

      // Set up auto-refresh every 5 seconds during market hours
      const interval = setInterval(() => {
        if (checkMarketStatus()) {
          fetchMarketData()
        } else {
          setIsMarketOpen(false)
        }
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [instrumentKey])

  // Check market status every minute
  useEffect(() => {
    const statusInterval = setInterval(() => {
      setIsMarketOpen(checkMarketStatus())
    }, 60000)

    return () => clearInterval(statusInterval)
  }, [])

  const getMarketStatusColor = () => {
    return isMarketOpen ? "bg-green-500" : "bg-red-500"
  }

  const getMarketStatusText = () => {
    return isMarketOpen ? "Market Open" : "Market Closed"
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true,
    })
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatVolume = (volume) => {
    if (volume >= 10000000) {
      return `${(volume / 10000000).toFixed(1)}Cr`
    } else if (volume >= 100000) {
      return `${(volume / 100000).toFixed(1)}L`
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`
    }
    return volume.toString()
  }

  return (
    <div className="space-y-6">
      {/* Market Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Real-time Market Data
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={`${getMarketStatusColor()} text-white`}>{getMarketStatusText()}</Badge>
              <Button variant="outline" size="sm" onClick={fetchMarketData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Market Hours: 9:15 AM - 3:15 PM IST
            </div>
            {lastUpdate && <div className="mt-1">Last Updated: {formatTime(lastUpdate)}</div>}
          </div>
        </CardContent>
      </Card>

      {/* Market Data Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-red-700">Error: {error}</div>
          </CardContent>
        </Card>
      )}

      {marketData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Current Price */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Price</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold">{formatCurrency(marketData.ltp)}</div>
                <div
                  className={`flex items-center gap-1 text-lg font-medium ${
                    marketData.change >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {marketData.change >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  {marketData.change >= 0 ? "+" : ""}
                  {marketData.change.toFixed(2)}({marketData.changePercent >= 0 ? "+" : ""}
                  {marketData.changePercent.toFixed(2)}%)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Range */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Price Range</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Open:</span>
                  <span className="font-medium">{formatCurrency(marketData.open)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">High:</span>
                  <span className="font-medium text-green-600">{formatCurrency(marketData.high)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Low:</span>
                  <span className="font-medium text-red-600">{formatCurrency(marketData.low)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Prev Close:</span>
                  <span className="font-medium">{formatCurrency(marketData.close)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Volume */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">{formatVolume(marketData.volume)}</div>
                <div className="text-sm text-gray-600">Total Volume Traded</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((marketData.volume / 10000000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Market Timing Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Market Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Trading Sessions</h4>
              <ul className="space-y-1 text-gray-600">
                <li>Pre-market: 9:00 AM - 9:15 AM</li>
                <li>Regular: 9:15 AM - 3:30 PM</li>
                <li>Post-market: 3:40 PM - 4:00 PM</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Current Status</h4>
              <div className="space-y-1 text-gray-600">
                <div>Instrument: {instrumentKey}</div>
                <div>Exchange: NSE</div>
                <div>Segment: Equity</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isMarketOpen && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="text-yellow-800">
              <strong>Note:</strong> Market is currently closed. Real-time data will be available during market hours
              (9:15 AM - 3:15 PM IST, Monday to Friday).
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
