"use client"

import { useState, useEffect, useRef } from "react"
import { Activity } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNavigate, useParams } from "react-router-dom"
import { useGetOptionsQuery } from "@/store/api/options.api"
import { useGetContestByIdQuery } from "@/store/api/contest"
import { CompactContestInfo } from "./CompactContestInfo"
import { MobileOptionChain } from "./option-chain/MobileOptionChain"
import { DesktopOptionChain } from "./option-chain/DesktopOptionChain"

const OptionChain = () => {
  const [selectedIndex, setSelectedIndex] = useState("NSE_INDEX|Nifty Bank")
  const [selectedExpiry, setSelectedExpiry] = useState("2025-06-12")
  const [optionChainData, setOptionChainData] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [expiryDates, setExpiryDates] = useState([])
  const navigate = useNavigate()
  const atmRowRef = useRef(null)
  const { id } = useParams()

  const {
    data: contestData,
    error: contestError,
    isLoading: contestLoading,
  } = useGetContestByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  })

  const {
    data: initialData,
    error: queryError,
    isLoading: queryLoading,
  } = useGetOptionsQuery({
    expiry_date: selectedExpiry,
    instrument_key: selectedIndex,
  })

  const processOptionData = (apiResponse) => {
    if (!apiResponse?.success || !apiResponse?.option_chain?.length) {
      setError(apiResponse?.message || "No option chain data available")
      setIsLoading(false)
      return
    }

    setOptionChainData(apiResponse)
    setIsLoading(false)
    setError(null)
    setLastUpdated(new Date(apiResponse.timestamp))
  }

  useEffect(() => {
    if (queryLoading) {
      setIsLoading(true)
      setConnectionStatus("loading")
    } else if (queryError) {
      setError(queryError?.data?.message || "Error fetching initial option chain data")
      setIsLoading(false)
      setConnectionStatus("error")
    } else if (initialData) {
      processOptionData(initialData)
      setConnectionStatus("connected")

      setTimeout(() => {
        if (atmRowRef.current) {
          atmRowRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          })
        }
      }, 100)
    }
  }, [initialData, queryError, queryLoading])

  useEffect(() => {
    setIsLoading(true)
    setConnectionStatus("connecting")

    const eventSource = new EventSource(
      `/api/v1/option-chain-stream?instrument_key=${encodeURIComponent(selectedIndex)}&expiry_date=${selectedExpiry}`,
    )

    eventSource.onopen = () => {
      setConnectionStatus("connected")
      console.log("✅ Connected to option chain stream")
    }

    eventSource.onmessage = (event) => {
      try {
        const apiResponse = JSON.parse(event.data)

        if (apiResponse.success && apiResponse.option_chain) {
          processOptionData(apiResponse)
          setConnectionStatus("connected")
        } else if (apiResponse.message && !apiResponse.success) {
          setError(apiResponse.message)
          setConnectionStatus("error")
        }
      } catch (err) {
        console.error("Error parsing SSE data:", err)
        setError("Error processing real-time data")
      }
    }

    eventSource.onerror = (e) => {
      console.error("SSE Error:", e)
      setError("Connection to data stream lost. Trying to reconnect...")
      setConnectionStatus("reconnecting")
    }

    return () => {
      eventSource.close()
      setConnectionStatus("disconnected")
    }
  }, [selectedIndex, selectedExpiry])

  useEffect(() => {
    const fetchExpiryDates = async () => {
      try {
        const response = await fetch(`/api/v1/available-expiry-dates?instrument_key=${selectedIndex}`)
        const data = await response.json()

        if (data.success && data.expiry_dates) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          const filteredDates = data.expiry_dates.filter((date) => {
            const expiryDate = new Date(date)
            return expiryDate >= today
          })

          filteredDates.sort((a, b) => new Date(a) - new Date(b))
          setExpiryDates(filteredDates)

          const currentExpiryDate = new Date(selectedExpiry)
          if (currentExpiryDate < today || !filteredDates.includes(selectedExpiry)) {
            setSelectedExpiry(filteredDates[0])
          }

          console.log(`✅ Loaded ${filteredDates.length} valid expiry dates`)
        }
      } catch (error) {
        console.error("Error fetching expiry dates:", error)
      }
    }

    fetchExpiryDates()
  }, [selectedIndex])

  const handleOptionClick = (strikeData, type) => {
    if (!strikeData) return

    const optionData = type === "call" ? strikeData.call_option : strikeData.put_option
    if (!optionData?.instrument_key) return

    navigate(`/option-details/${id}/${optionData.instrument_key}?type=${type}&strike=${strikeData.strike_price}`)
  }

  const formatPrice = (price) => {
    if (!price || price === 0) return "₹0.00"
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(price)
      .replace("₹", "₹")
  }

  const formatOI = (oi) => {
    if (!oi) return "0"
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(oi)
  }

  const calculatePriceChange = (ltp, closePrice) => {
    if (!ltp || !closePrice || closePrice === 0) return { change: 0, changePercent: 0 }
    const change = ltp - closePrice
    const changePercent = (change / closePrice) * 100
    return {
      change: change.toFixed(2),
      changePercent: changePercent.toFixed(2),
    }
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "bg-green-500"
      case "connecting":
      case "reconnecting":
        return "bg-yellow-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getATMStrike = () => {
    if (!optionChainData?.underlying_info?.spot_price) return null
    const spotPrice = optionChainData.underlying_info.spot_price

    const strikes = optionChainData.option_chain.map((item) => item.strike_price)
    return strikes.reduce((prev, curr) => (Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev))
  }

  const atmStrike = getATMStrike()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-8 mx-auto px-2 py-4 gap-4">
      <div className="lg:col-span-5">
           {/* Controls - More Compact */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex gap-2">
            <Select value={selectedIndex} onValueChange={setSelectedIndex}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NSE_INDEX|Nifty Bank">BANKNIFTY</SelectItem>
                <SelectItem value="NSE_INDEX|Nifty 50">NIFTY</SelectItem>
                <SelectItem value="NSE_INDEX|Nifty Fin Service">FINNIFTY</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {expiryDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {new Date(date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        {/* Compact Contest Info */}
        <CompactContestInfo contestData={contestData} />

     
     

        {/* Option Chain */}
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid grid-cols-9 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((j) => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">{error}</div>
        ) : (
          <>
            <MobileOptionChain
              data={optionChainData}
              onOptionClick={handleOptionClick}
              formatPrice={formatPrice}
              formatOI={formatOI}
              atmStrike={atmStrike}
            />
            <DesktopOptionChain
              data={optionChainData}
              onOptionClick={handleOptionClick}
              formatPrice={formatPrice}
              formatOI={formatOI}
              atmStrike={atmStrike}
              calculatePriceChange={calculatePriceChange}
            />
          </>
        )}
      </div>

      {/* Compact Sidebar */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Positions & Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Positions */}
            <div>
              <h3 className="text-sm font-medium mb-2">Open Positions</h3>
              {contestData?.contest?.participation?.positions?.length > 0 ? (
                <div className="space-y-2">
                  {contestData.contest.participation.positions.map((position) => (
                    <div key={position.id} className="p-2 rounded-lg border bg-muted/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">
                          {position.strikePrice} {position.optionType}
                        </span>
                        <Badge variant={position.pnl >= 0 ? "default" : "destructive"} className="text-xs">
                          {position.pnl >= 0 ? "+" : ""}
                          {position.pnl.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Qty: {position.quantity}</div>
                        <div>Avg: ₹{position.averagePrice}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 text-muted-foreground text-sm">No positions</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default OptionChain
