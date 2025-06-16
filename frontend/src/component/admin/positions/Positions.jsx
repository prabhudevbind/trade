import { useGetTradesActiveQuery } from '@/store/api/contest'
import React, { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"

export default function Positions() {
  const { data: activeTradesData, isLoading, isError, error } = useGetTradesActiveQuery();
  const [positions, setPositions] = useState([]);
  const [totalPnL, setTotalPnL] = useState(0);

  // Set up real-time price updates for each position
  useEffect(() => {
    if (!activeTradesData?.positions) return;

    setPositions(activeTradesData.positions);

    const eventSources = activeTradesData.positions.map(position => {
      // Format the instrument key as NSE_FO|symbol
      const instrumentKey = `NSE_FO|${position.option.symbol}`;
      const es = new EventSource(`http://localhost:5001/stream/${instrumentKey}`);
      
      es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.instrumentKey === instrumentKey) {
          setPositions(prev => prev.map(p => {
            if (p.option.symbol === position.option.symbol) {
              const newLtp = data.data.ff.marketFF.ltpc.ltp;
              const pnl = (newLtp - parseFloat(p.average_entry_price)) * p.net_quantity;
              return {
                ...p,
                option: {
                  ...p.option,
                  ltp: newLtp
                },
                unrealizedPnL: pnl,
                currentValue: newLtp * p.net_quantity
              };
            }
            return p;
          }));
        }
      };

      return es;
    });

    // Cleanup function
    return () => {
      eventSources.forEach(es => es.close());
    };
  }, [activeTradesData?.positions]);

  // Calculate total P&L
  useEffect(() => {
    const total = positions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0);
    setTotalPnL(total);
  }, [positions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="text-gray-500">Loading positions data...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const isNoActiveContest = error?.data?.error === "No active contest found for this user";
    
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-6">
        <div className="text-center space-y-6 max-w-md">
          {isNoActiveContest ? (
            <>
              <Trophy className="h-16 w-16 text-gray-400 mx-auto" />
              <h2 className="text-2xl font-semibold text-gray-800">No Active Contest</h2>
              <p className="text-gray-600">
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-800">Error Loading Positions</h2>
              <p className="text-gray-600">
                {error?.data?.error || "Something went wrong while loading your positions. Please try again."}
              </p>
              <Button onClick={() => window.location.reload()} className="w-full mt-4" variant="outline" size="lg">
                Retry
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Virtual Cash</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{parseFloat(activeTradesData?.virtualCash || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contest Info */}
      <Card>
        <CardHeader>
          <CardTitle>{activeTradesData?.contest?.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Max Trades: {activeTradesData?.contest?.maxTrade} | Entry Fee: ₹{activeTradesData?.contest?.entry_fee}
          </div>
        </CardContent>
      </Card>

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableCell>{position.option.symbol}</TableCell>
                  <TableCell>{position.option.strike_price}</TableCell>
                  <TableCell>
                    <Badge variant={position.option.option_type === 'CE' ? 'default' : 'destructive'}>
                      {position.option.option_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{position.net_quantity}</TableCell>
                  <TableCell>₹{parseFloat(position.average_entry_price).toFixed(2)}</TableCell>
                  <TableCell>₹{parseFloat(position.option.ltp).toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{position.currentValue.toFixed(2)}</TableCell>
                  <TableCell className={`text-right ${position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {position.unrealizedPnL >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      ₹{position.unrealizedPnL.toFixed(2)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {positions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No open positions
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
