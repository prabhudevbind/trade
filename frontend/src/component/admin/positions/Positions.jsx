"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  History,
  BarChart3,
  Trophy,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { io } from "socket.io-client";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetTradesActiveQuery,
  useSellPositionMutation,
} from "@/store/api/contest";
import { socketServerUrl } from "@/lib/utidata";

// Dummy data

export default function PositionsPage({
  only = false,
  options = false,
  onlyprice = false,
}) {
  const {
    data: activeTradesData,
    isLoading,
    isError,
    error,
    refetch
  } = useGetTradesActiveQuery();
  const [activePositions, setActivePositions] = useState([]);
  const [closedPositions, setClosedPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const router = useNavigate();

  const [sellPosition] = useSellPositionMutation();
  // Sell Modal State
  const [sellModal, setSellModal] = useState({
    open: false,
    position: null,
  });
  const [sellQty, setSellQty] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState("");

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load initial positions and trades
  useEffect(() => {
    if (!activeTradesData) return;
    const active = activeTradesData.positions.filter(
      (pos) => pos.net_quantity > 0
    );
    const closed = activeTradesData.positions.filter(
      (pos) => pos.net_quantity === 0
    );

    setActivePositions(active);
    setClosedPositions(closed);
    setTrades(activeTradesData.trades);
  }, [activeTradesData,refetch]);

  // Real-time market data updates for positions
  useEffect(() => {
    if (!activeTradesData?.positions) return;

    setActivePositions(
      activeTradesData.positions.filter((pos) => pos.net_quantity > 0)
    );
    setClosedPositions(
      activeTradesData.positions.filter((pos) => pos.net_quantity === 0)
    );
    setTrades(activeTradesData.trades);

    // Connect to Socket.IO server
    const socket = io("", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      autoConnect: true,
    });

    // Subscribe to all instrumentKeys
    const instrumentKeys = activeTradesData.positions.map(
      (position) => `NSE_FO|${position.option.symbol}`
    );
    instrumentKeys.forEach((instrumentKey) => {
      socket.emit("subscribe", instrumentKey);
    });

    // Listen for market data updates
    socket.on("marketData", (data) => {
      if (!data || !data.instrumentKey) return;
      setActivePositions((prev) =>
        prev.map((p) => {
          if (`NSE_FO|${p.option.symbol}` === data.instrumentKey) {
            const newLtp =
              data.data?.ltpc?.ltp ??
              data.data?.ff?.marketFF?.ltpc?.ltp ??
              data.data?.ltp ??
              p.option.ltp;
            const pnl =
              (newLtp - Number.parseFloat(p.average_entry_price)) *
              p.net_quantity;
            return {
              ...p,
              option: {
                ...p.option,
                ltp: newLtp,
              },
              unrealizedPnL: pnl,
              currentValue: newLtp * p.net_quantity,
            };
          }
          return p;
        })
      );
    });

    // Cleanup on unmount
    return () => {
      instrumentKeys.forEach((instrumentKey) => {
        socket.emit("unsubscribe", instrumentKey);
      });
      socket.disconnect();
    };
  }, [activeTradesData?.positions,refetch]);
  useEffect(()=>{refetch();},[refetch]);
  // Sell handler
  const handleSell = async () => {
    if (!sellModal.position) return;
    setSellLoading(true);
    setSellError("");
    try {
      await sellPosition({
        id: sellModal.position.id,
        sellQuantity: sellQty,
        sellPrice: sellPrice,
      });
      setSellModal({ open: false, position: null });
      setSellQty(0);
      setSellPrice(0);
      // window.location.reload();
    } catch (err) {
      setSellError(err.response?.data?.error || "Sell failed");
    } finally {
      setSellLoading(false);
    }
  };

  // Calculate realized P&L for closed positions
  const calculateRealizedPnL = (position) => {
    const relatedTrades = trades.filter(
      (trade) => trade.symbol === position.option.symbol
    );
    let totalBuy = 0;
    let totalSell = 0;
    relatedTrades.forEach((trade) => {
      if (trade.action === "buy") {
        totalBuy += trade.value;
      } else {
        totalSell += trade.value;
      }
    });
    return totalSell - totalBuy;
  };

  // Portfolio calculations (frontend, always up-to-date)
  const initialCash = 100000;
  const totalBuyValue = trades
    .filter((t) => t.action === "buy")
    .reduce((sum, t) => sum + t.price * t.quantity, 0);
  const totalSellValue = trades
    .filter((t) => t.action === "sell")
    .reduce((sum, t) => sum + t.price * t.quantity, 0);
  const virtualCash = initialCash - totalBuyValue + totalSellValue;
  const currentPositionsValue = activePositions.reduce(
    (sum, pos) => sum + Number(pos.option.ltp) * pos.net_quantity,
    0
  );
  const portfolioValue = currentPositionsValue;
  const totalPnL = virtualCash + portfolioValue - initialCash;

  // UI rendering
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-600 text-sm">Loading positions...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const isNoActiveContest =
      error?.data?.error === "No active contest found for this user";
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          {isNoActiveContest ? (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold  mb-2">No Active Contest</h2>
              <p className="text-gray-600 text-sm mb-6">
                Join a contest to start trading and see your positions here.
              </p>
              <Link to="/contests">
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-600 text-sm mb-6">
                {error?.data?.error ||
                  "Unable to load your positions. Please try again."}
              </p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Try Again
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!activeTradesData) {
    return <p>...loading</p>;
  }

  const PositionCard = ({ position, isActive = true, options = false }) => {
    const ltp = Number(position.option.ltp) || 0;
    const avgPrice = Number(position.average_entry_price) || 0;
    const realizedPnL = isActive ? 0 : calculateRealizedPnL(position);
    const pnl = isActive ? position.unrealizedPnL || 0 : realizedPnL;
    const pnlPercentage =
      avgPrice > 0 ? ((ltp - avgPrice) / avgPrice) * 100 : 0;
    const isProfit = pnl >= 0;

    return (
      <div className="  rounded-lg border border-gray-200 p-4 mb-3 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="flex-1">
              <div className="font-semibold  text-base">
                {position.option.symbol}
              </div>
              <div className="text-xs">
                {position.option.strike_price} {position.option.option_type} •
                Qty: {Math.abs(position.net_quantity)}
                {!isActive && (
                  <span className="ml-2 text-orange-600">(Closed)</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge
              variant={
                position.option.option_type === "CE" ? "default" : "destructive"
              }
              className="text-xs"
            >
              {position.option.option_type}
            </Badge>
          </div>
        </div>

        {/* Price and P&L */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-lg font-bold ">₹{ltp.toFixed(2)}</div>
            <div className="text-xs ">LTP</div>
          </div>
          <div className="text-right">
            <div
              className={`text-lg font-bold flex items-center ${
                isProfit ? "text-green-600" : "text-red-600"
              }`}
            >
              {isProfit ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              ₹{Math.abs(pnl).toFixed(2)}
            </div>
            <div
              className={`text-xs ${
                isProfit ? "text-green-600" : "text-red-600"
              }`}
            >
              {isActive
                ? `${isProfit ? "+" : "-"}${Math.abs(pnlPercentage).toFixed(
                    2
                  )}%`
                : "Realized"}
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {!options && (
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
            <div>
              <span>Avg: ₹{avgPrice.toFixed(2)}</span>
            </div>
            <div>
              <span>
                Value: ₹
                {isActive
                  ? (ltp * Math.abs(position.net_quantity)).toFixed(2)
                  : "0.00"}
              </span>
            </div>
          </div>
        )}
        {isActive && position.net_quantity > 0 && !options && (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 w-full bg-transparent"
            onClick={() => {
              setSellModal({ open: true, position });
              setSellQty(position.net_quantity);
              setSellPrice(Number(position.option.ltp));
            }}
          >
            Sell
          </Button>
        )}
      </div>
    );
  };

  const TradeRow = ({ trade }) => {
    const isProfit = trade.action === "sell";
    return (
      <TableRow className="hover:bg-gray-50">
        <TableCell>
          <div>
            <div className="font-medium text-gray-900">
              {trade.option.symbol}
            </div>
            <div className="text-xs text-gray-500">
              {trade.option.strike_price} {trade.option.option_type}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge
            variant={trade.action === "buy" ? "default" : "destructive"}
            className="text-xs"
          >
            {trade.action.toUpperCase()}
          </Badge>
        </TableCell>
        <TableCell className="font-medium">{trade.quantity}</TableCell>
        <TableCell>₹{Number(trade.price).toFixed(2)}</TableCell>
        <TableCell className="text-right font-medium">
          ₹{trade.value.toFixed(2)}
        </TableCell>
        <TableCell className="text-xs text-gray-500">
          {new Date(trade.timestamp).toLocaleString()}
        </TableCell>
      </TableRow>
    );
  };

  if (only) {
    if (isLoading) {
      return (
        <div className="bg-white rounded-lg border shadow-sm p-4 w-full max-w-xs">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-6 bg-gray-100 rounded w-1/2"></div>
            <div className="h-4 bg-gray-100 rounded w-1/3"></div>
            <div className="h-4 bg-gray-100 rounded w-1/4"></div>
          </div>
        </div>
      );
    }
    if (isError || !activeTradesData) {
      return (
        <div className="bg-white rounded-lg border shadow-sm p-4 w-full max-w-xs text-red-500 text-sm">
          Error loading summary
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3  border-red-800 gap-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Virtual Cash</div>
          <div className="font-semibold ">
            ₹
            {virtualCash.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Portfolio Value</div>
          <div className="font-semibold ">
            ₹
            {portfolioValue.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs mb-1">Total P&L</div>
          <div
            className={`font-semibold ${
              totalPnL >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {totalPnL >= 0 ? "+" : ""}₹{totalPnL.toFixed(2)}
          </div>
        </div>
      </div>
    );
  }

  if (options) {
    if (isLoading) {
      return (
        <div className="bg-white rounded-lg border shadow-sm p-4 w-full max-w-xs">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-6 bg-gray-100 rounded w-1/2"></div>
            <div className="h-4 bg-gray-100 rounded w-1/3"></div>
            <div className="h-4 bg-gray-100 rounded w-1/4"></div>
          </div>
        </div>
      );
    }
    if (isError || !activeTradesData) {
      return (
        <div className="bg-white rounded-lg border shadow-sm p-4 w-full max-w-xs text-red-500 text-sm">
          Error loading summary
        </div>
      );
    }
    return (
      <>
        <div>
          {activePositions.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center shadow-sm border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 mb-2">
                No active positions
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Start trading to see your positions here
              </p>
              <Link to={`/option-chain/${activeTradesData.contest.id}`}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Start Trading
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activePositions.map((position) => (
                <PositionCard
                  options={true}
                  key={position.id}
                  position={position}
                  isActive={true}
                />
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  if (onlyprice) {
    if (isLoading) {
      return (
        <div className="bg-white rounded-lg border shadow-sm p-4 w-full max-w-xs">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-6 bg-gray-100 rounded w-1/2"></div>
            <div className="h-4 bg-gray-100 rounded w-1/3"></div>
            <div className="h-4 bg-gray-100 rounded w-1/4"></div>
          </div>
        </div>
      );
    }
    return (
      <div
        className={`font-semibold ${
          totalPnL >= 0 ? "text-green-600" : "text-red-600"
        }`}
      >
        {totalPnL >= 0 ? "+" : ""}₹{totalPnL.toFixed(2)}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Portfolio</h1>
        </div>
      </div>

      <div className="p-2 space-y-4">
        {/* Summary Section */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Virtual Cash</div>
              <div className="font-semibold text-gray-900">
                ₹
                {virtualCash.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Portfolio Value</div>
              <div className="font-semibold text-gray-900">
                ₹
                {portfolioValue.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Total P&L</div>
              <div
                className={`font-semibold ${
                  totalPnL >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {totalPnL >= 0 ? "+" : ""}₹{totalPnL.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Contest Info */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900">
              {activeTradesData.contest.name}
            </h3>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-600 font-medium">Live</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Total Trades: {activeTradesData.summary.totalTrades}</span>
            <span>
              Active: {activeTradesData.summary.activePositions} | Closed:{" "}
              {closedPositions.length}
            </span>
          </div>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="positions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="positions" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Positions
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="trades" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              All Trades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="space-y-4">
            {/* Active Positions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium pl-3 text-gray-900">
                  Active Positions ({activePositions.length})
                </h3>
                {!isMobile && (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() =>
                      router(`/option-chain/${activeTradesData.contest.id}`)
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Position
                  </Button>
                )}
              </div>

              {activePositions.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center shadow-sm border border-gray-200">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Eye className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    No active positions
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Start trading to see your positions here
                  </p>
                  <Link to={`/option-chain/${activeTradesData.contest.id}`}>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      Start Trading
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {activePositions.map((position) => (
                    <PositionCard
                      key={position.id}
                      position={position}
                      isActive={true}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {/* Closed Positions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium pl-3 text-gray-900">
                  Closed Positions ({closedPositions.length})
                </h3>
              </div>

              {closedPositions.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center shadow-sm border border-gray-200">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    No closed positions
                  </h3>
                  <p className="text-sm text-gray-600">
                    Your completed trades will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {closedPositions.map((position) => (
                    <PositionCard
                      key={position.id}
                      position={position}
                      isActive={false}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="trades" className="space-y-4">
            {/* All Trades */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium pl-3 text-gray-900">
                  All Trades ({trades.length})
                </h3>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-medium">Instrument</TableHead>
                      <TableHead className="font-medium">Action</TableHead>
                      <TableHead className="font-medium">Qty</TableHead>
                      <TableHead className="font-medium">Price</TableHead>
                      <TableHead className="font-medium text-right">
                        Value
                      </TableHead>
                      <TableHead className="font-medium">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((trade) => (
                      <TradeRow key={trade.id} trade={trade} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sell Modal */}
      <Dialog
        open={sellModal.open}
        onOpenChange={(open) => setSellModal({ open, position: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sell Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={sellModal.position?.net_quantity || 0}
                value={sellQty}
                onChange={(e) => setSellQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                disabled
                value={sellPrice}
                onChange={(e) => setSellPrice(Number(e.target.value))}
              />
            </div>
            {sellError && (
              <Alert variant="destructive">
                <AlertDescription>{sellError}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleSell}
                disabled={
                  sellLoading ||
                  sellQty < 1 ||
                  sellQty > (sellModal.position?.net_quantity || 0)
                }
                className="bg-red-600 hover:bg-red-700 text-white flex-1"
              >
                {sellLoading ? "Processing..." : "Confirm Sell"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSellModal({ open: false, position: null })}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Action Button */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3"
            size="lg"
            onClick={() =>
              router(`/option-chain/${activeTradesData.contest.id}`)
            }
          >
            <Plus className="h-5 w-5 mr-2" />
            New Position
          </Button>
        </div>
      )}

      {/* Bottom padding for mobile button */}
      {isMobile && <div className="h-20"></div>}
    </div>
  );
}
