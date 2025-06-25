"use client"

import { useGetTradesActiveQuery } from "@/store/api/contest"
import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Trophy, Plus, Smartphone, IndianRupee } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link, useNavigate } from "react-router-dom"

export default function Positions() {
  const { data: activeTradesData, isLoading, isError, error } = useGetTradesActiveQuery()
  const [positions, setPositions] = useState([])
  const [totalPnL, setTotalPnL] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const navigate = useNavigate()

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Set up real-time price updates for each position
  useEffect(() => {
    if (!activeTradesData?.positions) return

    setPositions(activeTradesData.positions)

    const eventSources = activeTradesData.positions.map((position) => {
      // Format the instrument key as NSE_FO|symbol
      const instrumentKey = `NSE_FO|${position.option.symbol}`
      const es = new EventSource(`http://localhost:5001/stream/${instrumentKey}`)

      es.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.instrumentKey === instrumentKey) {
          setPositions((prev) =>
            prev.map((p) => {
              if (p.option.symbol === position.option.symbol) {
                const newLtp = data.data.ff.marketFF.ltpc.ltp
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
        }
      }

      return es
    })

    // Cleanup function
    return () => {
      eventSources.forEach((es) => es.close())
    }
  }, [activeTradesData?.positions])

  // Calculate total P&L
  useEffect(() => {
    const total = positions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0)
    setTotalPnL(total)
  }, [positions])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-gray-500">Loading positions data...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    const isNoActiveContest = error?.data?.error === "No active contest found for this user"

    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] ">
        <div className="text-center  max-w-md">
          {isNoActiveContest ? (
            <>
              <Trophy className="h-16 w-16 text-gray-400 mx-auto" />
              <h2 className="text-xl md:text-2xl font-semibold text-gray-800">No Active Contest</h2>
              <p className="text-gray-600 text-sm md:text-base">
                You don't have any active contests at the moment. Join a contest to start trading!
              </p>
              <Link to="/contests">
                <Button className="w-full mt-4" size="lg">
                  Browse Available Contests
                </Button>
              </Link>
            </>
          ) : (
            <>
              <div className="text-red-500 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-16 w-16 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-gray-800">Error Loading Positions</h2>
              <p className="text-gray-600 text-sm md:text-base">
                {error?.data?.error || "Something went wrong while loading your positions. Please try again."}
              </p>
              <Button onClick={() => window.location.reload()} className="w-full mt-4" variant="outline" size="lg">
                Retry
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  const MobilePositionCard = ({ position }) => (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="font-semibold text-lg">{position.option.symbol}</div>
            <div className="text-sm text-gray-600">
              Strike: {position.option.strike_price} | Qty: {position.net_quantity}
            </div>
          </div>
          <Badge variant={position.option.option_type === "CE" ? "default" : "destructive"}>
            {position.option.option_type}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Avg Price</div>
            <div className="font-medium">₹{Number.parseFloat(position.average_entry_price).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">LTP</div>
            <div className="font-medium">₹{Number.parseFloat(position.option.ltp).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">Current Value</div>
            <div className="font-medium">₹{position.currentValue.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">P&L</div>
            <div
              className={`font-medium flex items-center gap-1 ${position.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {position.unrealizedPnL >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}₹
              {position.unrealizedPnL.toFixed(2)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Trade Now Button - Fixed at top on mobile */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b pb-4 mb-4 md:relative md:bg-transparent md:border-0 md:pb-0 md:mb-0">
        <Button
          className="w-full md:w-auto md:ml-auto md:flex bg-green-600 hover:bg-green-700 text-white font-semibold py-3 md:py-2"
          size={isMobile ? "lg" : "default"}
        onClick={() => navigate(`/option-chain/${activeTradesData.contest.id}`)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Trade Now
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Virtual Cash</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">
              ₹
              {Number.parseFloat(activeTradesData?.virtualCash || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            {totalPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-xl md:text-2xl font-bold ${totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
              ₹
              {totalPnL.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{totalPnL >= 0 ? "Profit" : "Loss"} • Real-time</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{positions.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Active trades</div>
          </CardContent>
        </Card>
      </div>

      {/* Contest Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">{activeTradesData?.contest?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm text-muted-foreground">
            <div>
              Max Trades: <span className="font-medium">{activeTradesData?.contest?.maxTrade}</span>
            </div>
            <div className="hidden md:block">•</div>
            <div>
              Entry Fee: <span className="font-medium">₹{activeTradesData?.contest?.entry_fee}</span>
            </div>
            <div className="hidden md:block">•</div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-600 font-medium">Live</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Positions - Mobile Cards or Desktop Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg md:text-xl">Open Positions</CardTitle>
            {isMobile && <Smartphone className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No open positions</p>
              <p className="text-sm mt-2">Start trading to see your positions here</p>
            </div>
          ) : (
            <>
              {/* Mobile View - Cards */}
              {isMobile ? (
                <div className="space-y-4">
                  {positions.map((position) => (
                    <MobilePositionCard key={position.id} position={position} />
                  ))}
                </div>
              ) : (
                /* Desktop View - Table */
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Strike</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Avg Price</TableHead>
                        <TableHead>LTP</TableHead>
                        <TableHead className="text-right">Current Value</TableHead>
                        <TableHead className="text-right">P&L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positions.map((position) => (
                        <TableRow key={position.id}>
                          <TableCell className="font-medium">{position.option.symbol}</TableCell>
                          <TableCell>{position.option.strike_price}</TableCell>
                          <TableCell>
                            <Badge variant={position.option.option_type === "CE" ? "default" : "destructive"}>
                              {position.option.option_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{position.net_quantity}</TableCell>
                          <TableCell>₹{Number.parseFloat(position.average_entry_price).toFixed(2)}</TableCell>
                          <TableCell>₹{Number.parseFloat(position.option.ltp).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">₹{position.currentValue.toFixed(2)}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${position.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {position.unrealizedPnL >= 0 ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              ₹{position.unrealizedPnL.toFixed(2)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Bottom Trade Button for Mobile */}
      {isMobile && positions.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 shadow-lg" size="lg"   onClick={() => navigate(`/option-chain/${activeTradesData.contest.id}`)}>
            <Plus className="h-5 w-5 mr-2" />
            New Trade
          </Button>
        </div>
      )}
    </div>
  )
}
