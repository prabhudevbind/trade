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
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react"

export default function Positions() {
  const { data: activeTradesData, isLoading, isError } = useGetTradesActiveQuery();
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

  if (isLoading) return <div>Loading positions data...</div>;
  if (isError) return <div>Error loading positions data.</div>;

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
