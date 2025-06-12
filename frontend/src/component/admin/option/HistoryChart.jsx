"use client"

import { useState } from "react"
import { TradingChart } from "./components/TradingChart.jsx"
import { RealTimeMarketData } from "./components/RealTimeMarketData.jsx"

import { TradeManager } from "./components/TradeManager.jsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useParams } from "react-router-dom"

export default function TradingDashboard() { 
 const {optionId}= useParams();
 
  const [selectedInstrument, setSelectedInstrument] = useState(optionId || "NSE_EQ|INE002A01018")
  const [trades, setTrades] = useState([])

  const addTrade = (trade) => {
    setTrades((prev) => [...prev, { ...trade, id: Date.now() }])
  }

  const removeTrade = (tradeId) => {
    setTrades((prev) => prev.filter((trade) => trade.id !== tradeId))
  }

  return (
    <>
      {/* <div className=" w-full mx-auto space-y-2"> */}
        {/* Header */}
        <div className="text-center">
          {/* <h1 className="text-3xl font-bold text-gray-900 mb-2">Trading Dashboard</h1> */}
          {/* <p className="text-gray-600">Advanced charting with real-time market data</p> */}
        </div>

        {/* Main Content */}
        {/* <Tabs defaultValue="chart" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chart">Chart Analysis</TabsTrigger>
            <TabsTrigger value="realtime">Real-time Data</TabsTrigger>
            <TabsTrigger value="trades">Trade Manager</TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="space-y-6">
            <Card>
             
              <CardContent>
                <TradingChart instrumentKey={selectedInstrument} trades={trades} onAddTrade={addTrade} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="realtime" className="space-y-6">
            <RealTimeMarketData instrumentKey={selectedInstrument} />
          </TabsContent>

          <TabsContent value="trades" className="space-y-6">
            <TradeManager trades={trades} onAddTrade={addTrade} onRemoveTrade={removeTrade} />
          </TabsContent>

         
        </Tabs> */}
         <TradingChart instrumentKey={selectedInstrument} trades={trades} onAddTrade={addTrade} />
      {/* </div> */}
    </>
  )
}
