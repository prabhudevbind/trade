"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, TrendingUp, TrendingDown } from "lucide-react"


export function TradeManager({ trades, onAddTrade, onRemoveTrade }) {
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString("en-IN")
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value)
  }

  const calculateTotalValue = (price, quantity) => {
    return price * quantity
  }

  const getTradeSummary = () => {
    const buyTrades = trades.filter((t) => t.type === "buy")
    const sellTrades = trades.filter((t) => t.type === "sell")

    const totalBuyValue = buyTrades.reduce((sum, trade) => sum + calculateTotalValue(trade.price, trade.quantity), 0)
    const totalSellValue = sellTrades.reduce((sum, trade) => sum + calculateTotalValue(trade.price, trade.quantity), 0)
    const totalBuyQuantity = buyTrades.reduce((sum, trade) => sum + trade.quantity, 0)
    const totalSellQuantity = sellTrades.reduce((sum, trade) => sum + trade.quantity, 0)

    const netQuantity = totalBuyQuantity - totalSellQuantity
    const netValue = totalSellValue - totalBuyValue

    return {
      totalBuyValue,
      totalSellValue,
      totalBuyQuantity,
      totalSellQuantity,
      netQuantity,
      netValue,
      avgBuyPrice: totalBuyQuantity > 0 ? totalBuyValue / totalBuyQuantity : 0,
      avgSellPrice: totalSellQuantity > 0 ? totalSellValue / totalSellQuantity : 0,
    }
  }

  const summary = getTradeSummary()

  return (
    <div className="space-y-6">
      {/* Trade Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Trades</div>
            <div className="text-2xl font-bold">{trades.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Net Position</div>
            <div className={`text-2xl font-bold ${summary.netQuantity >= 0 ? "text-green-600" : "text-red-600"}`}>
              {summary.netQuantity}
            </div>
            <div className="text-xs text-gray-500">{summary.netQuantity >= 0 ? "Long" : "Short"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Net P&L</div>
            <div className={`text-2xl font-bold ${summary.netValue >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(summary.netValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Avg Buy Price</div>
            <div className="text-2xl font-bold">
              {summary.avgBuyPrice > 0 ? formatCurrency(summary.avgBuyPrice) : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Trade Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Buy Orders
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total Quantity:</span>
                  <span className="font-medium">{summary.totalBuyQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Value:</span>
                  <span className="font-medium">{formatCurrency(summary.totalBuyValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Price:</span>
                  <span className="font-medium">
                    {summary.avgBuyPrice > 0 ? formatCurrency(summary.avgBuyPrice) : "-"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-red-600 mb-2 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Sell Orders
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total Quantity:</span>
                  <span className="font-medium">{summary.totalSellQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Value:</span>
                  <span className="font-medium">{formatCurrency(summary.totalSellValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Price:</span>
                  <span className="font-medium">
                    {summary.avgSellPrice > 0 ? formatCurrency(summary.avgSellPrice) : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trade List */}
      <Card>
        <CardHeader>
          <CardTitle>All Trades ({trades.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No trades recorded yet. Add trades from the chart view.
            </div>
          ) : (
            <div className="space-y-3">
              {trades
                .sort((a, b) => b.time - a.time)
                .map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Badge
                        variant={trade.type === "buy" ? "default" : "destructive"}
                        className={trade.type === "buy" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                      >
                        {trade.type.toUpperCase()}
                      </Badge>

                      <div>
                        <div className="font-medium">
                          {trade.quantity} @ {formatCurrency(trade.price)}
                        </div>
                        <div className="text-sm text-gray-600">
                          Total: {formatCurrency(calculateTotalValue(trade.price, trade.quantity))}
                        </div>
                        <div className="text-xs text-gray-500">{formatDate(trade.time)}</div>
                        {trade.notes && <div className="text-xs text-gray-600 mt-1">Note: {trade.notes}</div>}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRemoveTrade(trade.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
