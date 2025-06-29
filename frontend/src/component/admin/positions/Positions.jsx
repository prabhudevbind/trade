"use client"

import { useGetTradesActiveQuery } from "@/store/api/contest"
import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TrendingDown, Trophy, Plus, Eye, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Button } from "@/components/ui/button"
// import { useRouter } from "next/navigation"
import { Link, useNavigate } from "react-router-dom"

export default function Positions() {
  const { data: activeTradesData, isLoading, isError, error } = useGetTradesActiveQuery()
  const [positions, setPositions] = useState([])
  const [totalPnL, setTotalPnL] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const router = useNavigate()

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Set up real-time price updates for each position using Socket.IO
  useEffect(() => {
    if (!activeTradesData?.positions) return

    setPositions(activeTradesData.positions)

    // Connect to Socket.IO server (singleton per component instance)
    const socket = io("http://localhost:5001", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      autoConnect: true,
    })

    // Subscribe to all instrumentKeys
    const instrumentKeys = activeTradesData.positions.map((position) => `NSE_FO|${position.option.symbol}`)
    instrumentKeys.forEach((instrumentKey) => {
      socket.emit("subscribe", instrumentKey)
    })

    // Listen for market data updates
    socket.on("marketData", (data) => {
      if (!data || !data.instrumentKey) return
      setPositions((prev) =>
        prev.map((p) => {
          if (`NSE_FO|${p.option.symbol}` === data.instrumentKey) {
            // Defensive: handle both .data.ff.marketFF.ltpc.ltp and .data.ltp
            const newLtp = data.data?.ff?.marketFF?.ltpc?.ltp ?? data.data?.ltp ?? p.option.ltp
            const pnl = (newLtp - Number.parseFloat(p.average_entry_price)) * p.net_quantity
            return {
              ...p,
              option: {
                ...p.option,
                ltp: newLtp,
              },
              unrealizedPnL: pnl,
              currentValue: newLtp * p.net_quantity,
            }
          }
          return p
        }),
      )
    })

    // Cleanup: Unsubscribe and disconnect
    return () => {
      instrumentKeys.forEach((instrumentKey) => {
        socket.emit("unsubscribe", instrumentKey)
      })
      socket.disconnect()
    }
  }, [activeTradesData?.positions])

  // Calculate total P&L
  useEffect(() => {
    const total = positions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0)
    setTotalPnL(total)
  }, [positions])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-600 text-sm">Loading positions...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    const isNoActiveContest = error?.data?.error === "No active contest found for this user"

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          {isNoActiveContest ? (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Contest</h2>
              <p className="text-gray-600 text-sm mb-6">Join a contest to start trading and see your positions here.</p>
              <Link
                to="/contests"
                // className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg"
              >
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
                // onClick={() => router.push("/contests")}
              >
                Browse Contests
              </Button>
              </Link>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
              <p className="text-gray-600 text-sm mb-6">
                {error?.data?.error || "Unable to load your positions. Please try again."}
              </p>
              <Button onClick={() => window.location.reload()} variant="outline" size="lg" className="w-full">
                Try Again
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  const MobilePositionCard = ({ position }) => {
    const ltp = Number(position.option.ltp) || 0
    const avgPrice = Number(position.average_entry_price) || 0
    const pnl = position.unrealizedPnL || 0
    const pnlPercentage = avgPrice > 0 ? ((ltp - avgPrice) / avgPrice) * 100 : 0
    const isProfit = pnl >= 0

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-base">{position.option.symbol}</div>
              <div className="text-xs text-gray-500">
                {position.option.strike_price} {position.option.option_type} • Qty: {Math.abs(position.net_quantity)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={position.option.option_type === "CE" ? "default" : "destructive"} className="text-xs">
              {position.option.option_type}
            </Badge>
          </div>
        </div>

        {/* Price and P&L */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-lg font-bold text-gray-900">₹{ltp.toFixed(2)}</div>
            <div className="text-xs text-gray-500">LTP</div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold flex items-center ${isProfit ? "text-green-600" : "text-red-600"}`}>
              {isProfit ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}₹
              {Math.abs(pnl).toFixed(2)}
            </div>
            <div className={`text-xs ${isProfit ? "text-green-600" : "text-red-600"}`}>
              {isProfit ? "+" : "-"}
              {Math.abs(pnlPercentage).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <div>
            <span>Avg: ₹{avgPrice.toFixed(2)}</span>
          </div>
          <div>
            <span>Value: ₹{(ltp * Math.abs(position.net_quantity)).toFixed(2)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Positions</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary Section */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Invested</div>
              <div className="font-semibold text-gray-900">
                ₹
                {positions
                  .reduce((sum, pos) => sum + Number(pos.average_entry_price) * Math.abs(pos.net_quantity), 0)
                  .toFixed(0)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Current</div>
              <div className="font-semibold text-gray-900">
                ₹
                {positions
                  .reduce((sum, pos) => sum + Number(pos.option.ltp) * Math.abs(pos.net_quantity), 0)
                  .toFixed(0)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">P&L</div>
              <div className={`font-semibold ${totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalPnL >= 0 ? "+" : ""}₹{totalPnL.toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Contest Info */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900">{activeTradesData?.contest?.name}</h3>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-600 font-medium">Live</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Virtual Cash: ₹{Number(activeTradesData?.virtualCash || 0).toLocaleString()}</span>
            <span>{positions.length} positions</span>
          </div>
        </div>

        {/* Positions List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Holdings ({positions.length})</h3>
            {!isMobile && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => router.push(`/option-chain/${activeTradesData.contest.id}`)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Position
              </Button>
            )}
          </div>

          {positions.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center shadow-sm border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 mb-2">No positions yet</h3>
              <p className="text-sm text-gray-600 mb-4">Start trading to see your positions here</p>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => router.push(`/option-chain/${activeTradesData.contest.id}`)}
              >
                Start Trading
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile View */}
              {isMobile ? (
                <div>
                  {positions.map((position) => (
                    <MobilePositionCard key={position.id} position={position} />
                  ))}
                </div>
              ) : (
                /* Desktop Table */
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-medium">Instrument</TableHead>
                        <TableHead className="font-medium">Qty</TableHead>
                        <TableHead className="font-medium">Avg Price</TableHead>
                        <TableHead className="font-medium">LTP</TableHead>
                        <TableHead className="font-medium text-right">P&L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positions.map((position) => {
                        const pnl = position.unrealizedPnL || 0
                        const isProfit = pnl >= 0
                        return (
                          <TableRow key={position.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div>
                                <div className="font-medium text-gray-900">{position.option.symbol}</div>
                                <div className="text-xs text-gray-500">
                                  {position.option.strike_price} {position.option.option_type}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{position.net_quantity}</TableCell>
                            <TableCell>₹{Number(position.average_entry_price).toFixed(2)}</TableCell>
                            <TableCell className="font-medium">₹{Number(position.option.ltp).toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <div className={`font-medium ${isProfit ? "text-green-600" : "text-red-600"}`}>
                                {isProfit ? "+" : ""}₹{pnl.toFixed(2)}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Bottom Action Button */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3"
            size="lg"
            onClick={() => router.push(`/option-chain/${activeTradesData.contest.id}`)}
          >
            <Plus className="h-5 w-5 mr-2" />
            New Position
          </Button>
        </div>
      )}

      {/* Bottom padding for mobile button */}
      {isMobile && <div className="h-20"></div>}
    </div>
  )
}
