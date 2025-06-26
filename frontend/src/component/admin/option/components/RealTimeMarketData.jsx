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

  useEffect(() => {
    let eventSource;

    const connectToStream = () => {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource(`/stream/${encodeURIComponent(instrumentKey)}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.data?.ff?.marketFF) {
            const marketFF = data.data.ff.marketFF;
            
            setMarketData({
              ltp: marketFF.ltpc.ltp,
              change: marketFF.ltpc.ltp - marketFF.ltpc.cp,
              changePercent: ((marketFF.ltpc.ltp - marketFF.ltpc.cp) / marketFF.ltpc.cp) * 100,
              volume: parseInt(marketFF.eFeedDetails.vtt),
              high: marketFF.marketOHLC.ohlc[0].high,
              low: marketFF.marketOHLC.ohlc[0].low,
              open: marketFF.marketOHLC.ohlc[0].open,
              close: marketFF.ltpc.cp,
              timestamp: new Date(parseInt(marketFF.ltpc.ltt)).toISOString(),
              bidAsk: marketFF.marketLevel.bidAskQuote,
              greeks: marketFF.optionGreeks,
              oi: marketFF.eFeedDetails.oi,
              prevOI: marketFF.eFeedDetails.poi,
            });
            
            setLastUpdate(new Date());
            setIsMarketOpen(true);
            setError(null);
          }
        } catch (err) {
          console.error('Error parsing market data:', err);
          setError('Failed to parse market data');
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setError('Connection error. Retrying...');
        eventSource.close();
        setTimeout(connectToStream, 5000);
      };
    };

    connectToStream();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [instrumentKey])

  // ... keep existing helper functions (formatTime, formatCurrency, formatVolume)

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
              <Button variant="outline" size="sm"  disabled={loading}>
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
                  {marketData.change.toFixed(2)} ({marketData.changePercent.toFixed(2)}%)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bid-Ask Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bid-Ask Spread</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {marketData.bidAsk.slice(0, 3).map((quote, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-green-600">Bid: {quote.bp} ({quote.bq})</span>
                    <span className="text-red-600">Ask: {quote.ap} ({quote.aq})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Greeks Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Option Greeks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Delta: {marketData.greeks.delta.toFixed(4)}</div>
                <div>Theta: {marketData.greeks.theta.toFixed(4)}</div>
                <div>Gamma: {marketData.greeks.gamma.toFixed(4)}</div>
                <div>Vega: {marketData.greeks.vega.toFixed(4)}</div>
                <div>IV: {(marketData.greeks.iv * 100).toFixed(2)}%</div>
                <div>Rho: {marketData.greeks.rho.toFixed(4)}</div>
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
