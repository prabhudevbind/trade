"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, RefreshCw, TrendingUp, TrendingDown, Play, Pause, ZoomIn, ZoomOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateOptionMutation,useCreatePositionMutation,useCreateTradeMutation } from "@/store/api/contest"
import { useParams } from "react-router-dom"
import { toast } from "react-toastify"

export  function TradingChart({instrumentKey}) {
  const chartContainerRef = useRef(null)
  const chart = useRef(null)
  const lineSeries = useRef(null)
  const volumeSeries = useRef(null)
  const eventSourceRef = useRef(null)
  const {id}=useParams();


  // Use your original instrument key
  // const instrumentKey = "NSE_FO|58571"
   const [createOption] = useCreateOptionMutation();
  const [createPosition] = useCreatePositionMutation();
  const [createTrade] = useCreateTradeMutation();

  // Chart and data states
  const [data, setData] = useState([])
  const [volumeData, setVolumeData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState("intraday")
  const [showVolume, setShowVolume] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [chartReady, setChartReady] = useState(false)
  const [isStreamConnected, setIsStreamConnected] = useState(false)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false)

  // Trading states
  const [trades, setTrades] = useState([])
  const [orderQuantity, setOrderQuantity] = useState(30)
  const [orderPrice, setOrderPrice] = useState(0)
  const [orderType, setOrderType] = useState("market")
  const [selectedLotSize, setSelectedLotSize] = useState(30)

  // Real-time market data from your API
  const [marketData, setMarketData] = useState({
    ltp: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    volume: 0,
    oi: 0,
    bidPrice: 0,
    askPrice: 0,
    bidQty: 0,
    askQty: 0,
    cp: 0
  })

  // Add new state for last known values
  const [lastKnownData, setLastKnownData] = useState({
    ltp: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    volume: 0,
    oi: 0,
    bidPrice: 0,
    askPrice: 0,
    bidQty: 0,
    askQty: 0,
    cp: 0,
    timestamp: null
  });

  const timeframes = {
    intraday: {
      label: "1D",
      interval: "1minute",
      days: 1,
      description: "Intraday 1-minute data",
    },
    week: {
      label: "1W",
      interval: "30minute", // Changed to 30minute for weekly view
      days: 7,
      description: "Weekly 30-minute data",
    },
    month: {
      label: "1M",
      interval: "day",
      days: 30,
      description: "Monthly daily data",
    },
    quarter: {
      label: "3M",
      interval: "day",
      days: 90,
      description: "Quarterly daily data",
    },
  }

  const lotSizes = [30, 50, 75, 100, 150, 200]

  const formatDate = (date) => {
    return date.toISOString().split("T")[0]
  }

  const isWeekend = (date) => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  const getLastTradingDay = (date) => {
    const newDate = new Date(date)
    while (isWeekend(newDate)) {
      newDate.setDate(newDate.getDate() - 1)
    }
    return newDate
  }

  const getDateRange = (timeframe) => {
    let toDate = new Date()
    toDate = getLastTradingDay(toDate)
    
    let fromDate = new Date(toDate)
    const daysToSubtract = timeframes[timeframe].days
    let actualDays = 0
    
    while (actualDays < daysToSubtract) {
      fromDate.setDate(fromDate.getDate() - 1)
      if (!isWeekend(fromDate)) {
        actualDays++
      }
    }

    return {
      toDate: formatDate(toDate),
      fromDate: formatDate(fromDate),
    }
  }

  const convertToIndianTime = (timestamp) => {
    const date = new Date(timestamp)
    const indianTime = new Date(date.getTime())
    return Math.floor(indianTime.getTime() / 1000)
  }

  // Your original API fetch function
  const fetchHistoricalData = async (selectedTimeframe) => {
    setLoading(true)
    setError(null)
    try {
      const { toDate, fromDate } = getDateRange(selectedTimeframe)
      const interval = timeframes[selectedTimeframe].interval
      const encodedInstrumentKey = encodeURIComponent(instrumentKey)

      const url = `/api/v1/historical-data/${encodedInstrumentKey}/${interval}/${toDate}/${fromDate}`
      console.log('Fetching data from:', url)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData = await response.json()
      console.log('API Response:', responseData)

      if (!responseData.success || !responseData.data?.data?.candles) {
        throw new Error('Invalid API response structure')
      }

      const candles = responseData.data.data.candles

      // Format candle data based on timeframe
      const formattedData = candles.map(candle => {
        const timestamp = convertToIndianTime(new Date(candle[0]).getTime())
        const date = new Date(candle[0])
        const hours = date.getHours()
        const minutes = date.getMinutes()
        const timeInMinutes = hours * 60 + minutes
        
        // For weekly data, we don't need to filter by market hours
        if (selectedTimeframe === 'week') {
          return {
            time: timestamp,
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            value: parseFloat(candle[4])
          }
        }
        
        // For intraday, keep the market hours filter
        if (timeInMinutes >= 555 && timeInMinutes <= 930) {
          return {
            time: timestamp,
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            value: parseFloat(candle[4])
          }
        }
        return null
      }).filter(Boolean)

      // Create volume data with the same time filtering
      const formattedVolumeData = candles.map(candle => {
        const timestamp = convertToIndianTime(new Date(candle[0]).getTime())
        const date = new Date(candle[0])
        const hours = date.getHours()
        const minutes = date.getMinutes()
        const timeInMinutes = hours * 60 + minutes
        
        if (selectedTimeframe === 'week' || 
            (timeInMinutes >= 555 && timeInMinutes <= 930)) {
          return {
            time: timestamp,
            value: parseFloat(candle[5]),
            color: parseFloat(candle[4]) >= parseFloat(candle[1]) 
              ? "#4caf50" 
              : "#f44336"
          }
        }
        return null
      }).filter(Boolean)

      // Sort data
      formattedData.sort((a, b) => a.time - b.time)
      formattedVolumeData.sort((a, b) => a.time - b.time)

      setData(formattedData)
      setVolumeData(formattedVolumeData)
      
      // Set initial market data from last candle
      if (formattedData.length > 0) {
        const lastCandle = formattedData[formattedData.length - 1]
        setOrderPrice(lastCandle.value)
        
        // Update market data with latest values
        const highPrice = Math.max(...formattedData.slice(-20).map(d => d.high || d.value))
        const lowPrice = Math.min(...formattedData.slice(-20).map(d => d.low || d.value))
        const totalVolume = formattedVolumeData.reduce((sum, vol) => sum + vol.value, 0)
        
        setMarketData(prev => ({
          ...prev,
          ltp: lastCandle.value,
          high: highPrice,
          low: lowPrice,
          volume: totalVolume
        }))
      }
      
      setLastUpdated(new Date())
      setError(null)

    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
      setData([])
      setVolumeData([])
    } finally {
      setLoading(false)
    }
  }

  // Add this new function to fetch today's intraday data
  const fetchTodayIntraday = async () => {
    try {
      const encodedInstrumentKey = encodeURIComponent(instrumentKey);
      const url = `/api/v1/today-intraday/${encodedInstrumentKey}/1minute`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData = await response.json();
      
      if (!responseData.success || !responseData.data?.data?.candles) {
        throw new Error('Invalid intraday API response');
      }

      const candles = responseData.data.data.candles;
      
      // Check if we have today's data
      if (candles && candles.length > 0) {
        // Get the latest valid candle
        const latestCandle = candles[candles.length - 1];
        const candleDate = new Date(latestCandle[0]);
        const today = new Date();
        
        // Only update market data if the candle is from today
        if (candleDate.toDateString() === today.toDateString()) {
          const marketValues = {
            ltp: parseFloat(latestCandle[4]), // Close price
            cp: parseFloat(latestCandle[1]), // Open price
            high: parseFloat(latestCandle[2]),
            low: parseFloat(latestCandle[3]),
            volume: parseFloat(latestCandle[5]),
            timestamp: candleDate,
            lastCandle: {
              open: parseFloat(latestCandle[1]),
              high: parseFloat(latestCandle[2]),
              low: parseFloat(latestCandle[3]),
              close: parseFloat(latestCandle[4])
            }
          };

          setMarketData(prev => ({
            ...prev,
            ...marketValues
          }));

          // Don't update lastKnownData since we have live data
          setLastKnownData(prev => ({
            ...prev,
            timestamp: candleDate
          }));
        }
      }

      // Continue with existing formatting logic for chart data
      const formattedData = candles
        .map(candle => {
          const timestamp = convertToIndianTime(new Date(candle[0]).getTime());
          const date = new Date(candle[0]);
          const hours = date.getHours();
          const minutes = date.getMinutes();
          const timeInMinutes = hours * 60 + minutes;
          
          if (timeInMinutes >= 555 && timeInMinutes <= 930) {
            return {
              time: timestamp,
              open: parseFloat(candle[1]),
              high: parseFloat(candle[2]),
              low: parseFloat(candle[3]),
              close: parseFloat(candle[4]),
              value: parseFloat(candle[4])
            };
          }
          return null;
        })
        .filter(Boolean);

      const formattedVolumeData = candles
        .map(candle => {
          const timestamp = convertToIndianTime(new Date(candle[0]).getTime());
          const date = new Date(candle[0]);
          const timeInMinutes = date.getHours() * 60 + date.getMinutes();
          
          if (timeInMinutes >= 555 && timeInMinutes <= 930) {
            return {
              time: timestamp,
              value: parseFloat(candle[5]),
              color: parseFloat(candle[4]) >= parseFloat(candle[1]) ? "#4caf50" : "#f44336"
            };
          }
          return null;
        })
        .filter(Boolean);

      return { formattedData, formattedVolumeData };
    } catch (error) {
      console.error('Error fetching intraday data:', error);
      throw error;
    }
  };

  // Modify the setupStream function to combine data
  useEffect(() => {
    let isSubscribed = true; // Add flag to prevent race conditions
    const setupStream = async () => {
      if (!instrumentKey || !isSubscribed) return;

      try {
        setLoading(true);
        
        // Clean up existing connection first
        if (eventSourceRef.current) {
          console.log('Closing existing connection');
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        
        // Fetch both historical and intraday data
        const [intradayResult, historicalResult] = await Promise.all([
          fetchTodayIntraday(),
          fetchHistoricalData(timeframe)
        ]);

        if (!isSubscribed) return; // Check if component is still mounted

        const { formattedData: intradayData, formattedVolumeData: intradayVolume } = intradayResult;
        
        // Combine data
        const combinedData = [];
        const combinedVolume = [];
        
        // Add intraday data without duplicates
        intradayData.forEach(candleData => {
          if (!combinedData.some(d => d.time === candleData.time)) {
            combinedData.push(candleData);
          }
        });

        intradayVolume.forEach(volumeData => {
          if (!combinedVolume.some(v => v.time === volumeData.time)) {
            combinedVolume.push(volumeData);
          }
        });

        // Sort combined data
        combinedData.sort((a, b) => a.time - b.time);
        combinedVolume.sort((a, b) => a.time - b.time);

        // Update state
        setData(combinedData);
        setVolumeData(combinedVolume);

        // Set up single EventSource connection
        const encodedKey = encodeURIComponent(instrumentKey);
        console.log('Setting up new EventSource connection');
        eventSourceRef.current = new EventSource(`http://localhost:5001/stream/${encodedKey}`);

        eventSourceRef.current.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const streamData = JSON.parse(event.data);
            handleRealTimeUpdate(streamData);
            setIsStreamConnected(true);
            setError(null);
          } catch (err) {
            console.error('Stream parsing error:', err);
            setError('Failed to parse stream data');
          }
        };

        eventSourceRef.current.onerror = (error) => {
          if (!isSubscribed) return;
          console.error('Stream connection error:', error);
          setIsStreamConnected(false);
          setError('Stream connection lost. Reconnecting...');
        };

        setLoading(false);
        setError(null);

      } catch (error) {
        if (!isSubscribed) return;
        console.error('Setup error:', error);
        setError('Failed to initialize data');
        setLoading(false);
      }
    };

    setupStream();

    // Cleanup function
    return () => {
      isSubscribed = false;
      if (eventSourceRef.current) {
        console.log('Cleaning up EventSource connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsStreamConnected(false);
      }
    };
  }, [instrumentKey, timeframe]); // Add required dependencies

  // Add helper function to check for duplicate candles
  const isDuplicateCandle = (existingData, newCandle) => {
    return existingData.some(candle => 
      candle.time === newCandle.time && 
      candle.value === newCandle.value
    );
  };

  // Modify the handleRealTimeUpdate function
  const handleRealTimeUpdate = (marketDataUpdate) => {
    if (!marketDataUpdate?.data?.ff?.marketFF) return;
    
    const { marketFF } = marketDataUpdate.data.ff;
    const timestamp = convertToIndianTime(parseInt(marketFF.ltpc.ltt));
    
    // Store last known good values
    const updatedMarketData = {
      ltp: parseFloat(marketFF.ltpc.ltp),
      change: parseFloat(marketFF.ltpc.ltp) - parseFloat(marketFF.ltpc.cp),
      changePercent: ((parseFloat(marketFF.ltpc.ltp) - parseFloat(marketFF.ltpc.cp)) / parseFloat(marketFF.ltpc.cp)) * 100,
      high: parseFloat(marketFF.marketOHLC.ohlc[0].high),
      low: parseFloat(marketFF.marketOHLC.ohlc[0].low),
      volume: parseFloat(marketFF.eFeedDetails.vtt),
      oi: parseFloat(marketFF.eFeedDetails.oi),
      bidPrice: marketFF.marketLevel?.bidAskQuote?.[0]?.bp || 0,
      askPrice: marketFF.marketLevel?.bidAskQuote?.[0]?.ap || 0,
      bidQty: marketFF.marketLevel?.bidAskQuote?.[0]?.bq || 0,
      askQty: marketFF.marketLevel?.bidAskQuote?.[0]?.aq || 0,
      cp: parseFloat(marketFF.ltpc.cp),
      timestamp: new Date(),
      // Add OHLC data for the last candle
      lastCandle: {
        open: parseFloat(marketFF.marketOHLC.ohlc[2].open),
        high: parseFloat(marketFF.marketOHLC.ohlc[2].high),
        low: parseFloat(marketFF.marketOHLC.ohlc[2].low),
        close: parseFloat(marketFF.ltpc.ltp)
      }
    };

    // Always update last known data
    setLastKnownData(updatedMarketData);
    setMarketData(updatedMarketData);
    
    // Create new candle data
    const newData = {
      time: timestamp,
      value: updatedMarketData.ltp,
      open: updatedMarketData.lastCandle.open,
      high: updatedMarketData.lastCandle.high,
      low: updatedMarketData.lastCandle.low,
      close: updatedMarketData.ltp
    };

    const newVolumeData = {
      time: timestamp,
      value: updatedMarketData.volume,
      color: updatedMarketData.ltp >= updatedMarketData.cp ? "#4caf50" : "#f44336"
    };

    // Always update chart data with latest values
    setData(prevData => {
      if (!isDuplicateCandle(prevData, newData)) {
        const filteredData = prevData.filter(d => d.time !== newData.time);
        return [...filteredData, newData].sort((a, b) => a.time - b.time);
      }
      return prevData;
    });

    setVolumeData(prevVolume => {
      if (!isDuplicateCandle(prevVolume, newVolumeData)) {
        const filteredVolume = prevVolume.filter(v => v.time !== newVolumeData.time);
        return [...filteredVolume, newVolumeData].sort((a, b) => a.time - b.time);
      }
      return prevVolume;
    });

    setLastUpdated(new Date());
  };

  // Initialize chart
  useEffect(() => {
    const initChart = async () => {
      try {
        if (!chartContainerRef.current) return

        const { createChart, ColorType } = await import("lightweight-charts")
        
        if (chart.current) {
          chart.current.remove()
        }

        chart.current = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "#ffffff" },
            textColor: "#333333",
          },
          width: chartContainerRef.current.clientWidth,
          height: showVolume ? 600 : 500,
          grid: {
            vertLines: { color: "#e1e1e1" },
            horzLines: { color: "#e1e1e1" },
          },
          crosshair: { mode: 1 },
          rightPriceScale: {
            borderColor: "#cccccc",
            scaleMargins: {
              top: 0.1,
              bottom: showVolume ? 0.4 : 0.1,
            },
          },
          timeScale: {
            borderColor: "#cccccc",
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 50,
            tickMarkFormatter: (time) => {
              const date = new Date(time * 1000)
              return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
            }
          },
        })

        lineSeries.current = chart.current.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: '#2962FF',
          crosshairMarkerBackgroundColor: '#ffffff',
          lineType: 1,
        })

        if (showVolume) {
          volumeSeries.current = chart.current.addHistogramSeries({
            color: "#26a69a",
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
            scaleMargins: { top: 0.8, bottom: 0 },
          })
        }

        const handleResize = () => {
          if (chart.current && chartContainerRef.current) {
            chart.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
            })
          }
        }

        window.addEventListener("resize", handleResize)
        setChartReady(true)
        console.log('Chart initialized successfully')

        return () => {
          window.removeEventListener("resize", handleResize)
          if (chart.current) {
            chart.current.remove()
          }
        }

      } catch (err) {
        console.error('Error initializing chart:', err)
        setError('Failed to initialize chart: ' + err.message)
      }
    }

    initChart()
  }, [showVolume])

  // Update chart data while preserving zoom
  useEffect(() => {
    if (chartReady && lineSeries.current && data.length > 0) {
      try {
        console.log('Updating chart with data points:', data.length)
        
        // Get current visible range before updating
        const timeScale = chart.current.timeScale()
        const visibleRange = timeScale.getVisibleRange()
        
        lineSeries.current.setData(data)

        if (volumeSeries.current && volumeData.length > 0) {
          volumeSeries.current.setData(volumeData)
        }

        // Update trade markers
        if (trades.length > 0) {
          const markers = trades.map((trade) => ({
            time: trade.time,
            position: trade.type === "buy" ? "belowBar" : "aboveBar",
            color: trade.type === "buy" ? "#4caf50" : "#f44336",
            shape: trade.type === "buy" ? "circle" : "square",
            text: `${trade.type.toUpperCase()} ${trade.quantity} @ ₹${trade.price}`,
          }))
          lineSeries.current.setMarkers(markers)
        }

        // Restore zoom level or auto-scroll to latest
        if (isAutoScrollEnabled || !visibleRange) {
          timeScale.fitContent()
        } else {
          // Preserve zoom level with a slight delay to ensure data is rendered
          setTimeout(() => {
            if (chart.current && visibleRange) {
              chart.current.timeScale().setVisibleRange(visibleRange)
            }
          }, 100)
        }

        console.log('Chart data updated successfully')
      } catch (err) {
        console.error('Error updating chart data:', err)
        setError('Failed to update chart: ' + err.message)
      }
    }
  }, [data, volumeData, chartReady, trades, isAutoScrollEnabled])

  // Trading functions
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [tradeLimitReached, setTradeLimitReached] = useState(false);

  const placeBuyOrder = async () => {
    setIsPlacingOrder(true);
    setError(null);
    
    try {
      // Get the price based on order type
      const executionPrice = orderType === "market" ? marketData.ltp : orderPrice;

      // Create option record first
      const optionData = {
        symbol: instrumentKey.split('|')[1],
        strikePrice: executionPrice,
        expiryDate: new Date(),
        optionType: "CE",
        lotSize: selectedLotSize,
        ltp: marketData.ltp
      };

      const option = await createOption(optionData).unwrap();

      // Create trade record
      const tradeData = {
        contestId: id,
        optionId: option.option.id,
        action: "buy",
        quantity: orderQuantity,
        price: executionPrice,
        timestamp: new Date()
      };

      const trade = await createTrade(tradeData).unwrap();

      // Update local state and show success message
      const newTrade = {
        id: trade.id,
        time: Math.floor(Date.now() / 1000),
        type: "buy",
        quantity: orderQuantity,
        price: executionPrice,
        timestamp: new Date()
      };

      setTrades(prevTrades => [...prevTrades, newTrade]);
      toast.success("Trade executed successfully");

    } catch (err) {
      console.error('Failed to place buy order:', err);
      
      // Handle trade limit error specifically
      if (err?.data?.error?.includes("Maximum trades limit")) {
        setTradeLimitReached(true);
        toast.error("Trade limit reached", {
          description: `You've used all ${err.data.maxAllowed} allowed trades for this contest.`
        });
      } else {
        toast.error("Failed to place trade", {
          description: err.error || "Something went wrong"
        });
      }
      setError(err.error || 'Failed to place buy order');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const placeSellOrder = async () => {
    try {
      // Check if bid price is available  
      if (!marketData.bidPrice || marketData.bidPrice === 0) {
        setError("No bid price available");
        return;
      }

      const price = orderType === "market" ? marketData.bidPrice : orderPrice;

      // Create option record first
      const optionData = {
        symbol: instrumentKey.split('|')[1],
        strikePrice: price,
        expiryDate: new Date(),
        optionType: "CE", // or "PE" based on your needs
        lotSize: selectedLotSize,
        ltp: marketData.ltp
      };

      const option = await createOption(optionData).unwrap();

      // Create trade record
      const tradeData = {
        contestId: id,
        optionId: option.option.id,
        action: "sell",
        quantity: orderQuantity,
        price: price,
        timestamp: new Date()
      };

      const trade = await createTrade(tradeData).unwrap();

      // Create or update position
      const positionData = {
        contestId:id,
        optionId: option.option.id,
        netQuantity: -orderQuantity, // Negative for sell
        averageEntryPrice: price
      };

      await createPosition(positionData).unwrap();

      // Update local state
      const newTrade = {
        id: trade.id,
        time: Math.floor(Date.now() / 1000),
        type: "sell",
        quantity: orderQuantity,
        price: price,
        timestamp: new Date()
      };

      setTrades(prevTrades => [...prevTrades, newTrade]);
      setError(null);

    } catch (err) {
      console.error('Failed to place sell order:', err);
      setError(err.message || 'Failed to place sell order');
    }
  }

  const handleLotSizeChange = (lotSize) => {
    setSelectedLotSize(lotSize)
    setOrderQuantity(lotSize)
  }

  // Chart controls
  const zoomIn = () => {
    if (chart.current) {
      const timeScale = chart.current.timeScale()
      const visibleRange = timeScale.getVisibleRange()
      if (visibleRange) {
        const center = (visibleRange.from + visibleRange.to) / 2
        const range = (visibleRange.to - visibleRange.from) * 0.8
        timeScale.setVisibleRange({
          from: center - range / 2,
          to: center + range / 2
        })
      }
    }
  }

  const zoomOut = () => {
    if (chart.current) {
      const timeScale = chart.current.timeScale()
      const visibleRange = timeScale.getVisibleRange()
      if (visibleRange) {
        const center = (visibleRange.from + visibleRange.to) / 2
        const range = (visibleRange.to - visibleRange.from) * 1.2
        timeScale.setVisibleRange({
          from: center - range / 2,
          to: center + range / 2
        })
      }
    }
  }

  const fitContent = () => {
    if (chart.current) {
      chart.current.timeScale().fitContent()
    }
  }

  const toggleAutoScroll = () => {
    setIsAutoScrollEnabled(!isAutoScrollEnabled)
  }

  // Add these functions near the top of your file
  const isMarketOpen = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    return timeInMinutes >= 555 && timeInMinutes <= 915; // 9:15 AM to 3:15 PM
  };

  // Add state for environment
  const [isProduction, setIsProduction] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header - Mobile Friendly */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
              {instrumentKey}
            </h1>
            <Badge className={`${isStreamConnected ? 'bg-green-500' : 'bg-red-500'} text-white text-xs`}>
              {isStreamConnected ? 'LIVE' : 'DISCONNECTED'}
            </Badge>
          </div>
          <div className="text-xs sm:text-sm text-gray-500">
            Last Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "Never"}
          </div>
        </div>

        {/* Market Overview - Mobile Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
          <Card className="p-2 sm:p-4">
            <CardContent className="p-2 sm:p-4">
              <div className="text-sm text-gray-600">
                LTP
                <Badge className={`ml-2 ${isMarketOpen() ? 'bg-green-500' : 'bg-red-500'}`}>
                  {isMarketOpen() ? 'LIVE' : 'CLOSED'}
                </Badge>
              </div>
              <div className="text-xl font-bold">
                ₹{(isMarketOpen() ? marketData.ltp : lastKnownData.ltp).toFixed(2)}
              </div>
              <div className={`text-sm flex items-center gap-1 ${
                (isMarketOpen() ? marketData.change : lastKnownData.change) >= 0 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {(isMarketOpen() ? marketData.change : lastKnownData.change) >= 0 
                  ? <TrendingUp className="w-3 h-3" /> 
                  : <TrendingDown className="w-3 h-3" />
                }
                {(isMarketOpen() ? marketData.change : lastKnownData.change) >= 0 ? '+' : ''}
                {(isMarketOpen() ? marketData.change : lastKnownData.change).toFixed(2)} 
                ({(isMarketOpen() ? marketData.changePercent : lastKnownData.changePercent).toFixed(2)}%)
              </div>
              {!isMarketOpen() && lastKnownData.timestamp && (
                <div className="text-xs text-gray-500 mt-1">
                  Last Update: {lastKnownData.timestamp.toLocaleTimeString()}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="p-2 sm:p-4">
            <CardContent className="p-2 sm:p-4">
              <div className="text-sm text-gray-600">High / Low</div>
              <div className="text-lg font-semibold text-green-600">₹{marketData.high.toFixed(2)}</div>
              <div className="text-lg font-semibold text-red-600">₹{marketData.low.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="p-2 sm:p-4">
            <CardContent className="p-2 sm:p-4">
              <div className="text-sm text-gray-600">Volume</div>
              <div className="text-lg font-semibold">{(marketData.volume / 1000).toFixed(0)}K</div>
              <div className="text-sm text-gray-500">OI: {(marketData.oi / 1000).toFixed(0)}K</div>
            </CardContent>
          </Card>

          <Card className="p-2 sm:p-4">
            <CardContent className="p-2 sm:p-4">
              <div className="text-sm text-gray-600">Bid / Ask</div>
              <div className="text-sm">
                <span className="text-green-600">₹{marketData.bidPrice.toFixed(2)} ({marketData.bidQty})</span>
              </div>
              <div className="text-sm">
                <span className="text-red-600">₹{marketData.askPrice.toFixed(2)} ({marketData.askQty})</span>
              </div>
            </CardContent>
          </Card>

          <Card className="p-2 sm:p-4">
            <CardContent className="p-2 sm:p-4">
              <div className="text-sm text-gray-600">CP</div>
              <div className="text-lg font-semibold">₹{marketData.cp.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="p-2 sm:p-4">
            <CardContent className="p-2 sm:p-4">
              <div className="text-sm text-gray-600">Trades</div>
              <div className="text-lg font-semibold">{trades.length}</div>
              <div className="text-sm text-gray-500">
                Net: {trades.reduce((acc, trade) => 
                  acc + (trade.type === 'buy' ? trade.quantity : -trade.quantity), 0
                )} lots
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart and Trading Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Chart Controls - Mobile Friendly */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {Object.entries(timeframes).map(([key, config]) => (
                  <Button
                    key={key}
                    variant={timeframe === key ? "default" : "outline"}
                    size="sm"
                    className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2"
                    onClick={() => setTimeframe(key)}
                  >
                    {config.label}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                <Button variant="outline" size="sm" onClick={zoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={zoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={fitContent}>
                  Fit
                </Button>
                <Button 
                  variant={isAutoScrollEnabled ? "default" : "outline"} 
                  size="sm" 
                  onClick={toggleAutoScroll}
                >
                  {isAutoScrollEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  Auto
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchHistoricalData(timeframe)}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={showVolume}
                    onChange={(e) => setShowVolume(e.target.checked)}
                    className="mr-2"
                  />
                  Volume
                </label>
              </div>
            </div>

            {/* Chart Card with Loading State */}
            <Card>
              <CardContent className="p-0 relative">
                <div 
                  ref={chartContainerRef} 
                  className="w-full" 
                  style={{ 
                    height: showVolume ? "400px" : "300px",
                    background: "#ffffff"
                  }} 
                />
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                      <span className="text-sm font-medium">Loading chart data...</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                <div className="flex items-center text-red-700">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <span>{error}</span>
                </div>
              </div>
            )}
          </div>

          {/* Trading Panel - Mobile Friendly */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="p-3 sm:p-4">
                <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                  Quick Trade
                  {tradeLimitReached && (
                    <Badge variant="destructive" className="ml-2">
                      Trade Limit Reached
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-3">
                {tradeLimitReached ? (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                    <h3 className="font-semibold text-destructive">Trade Limit Reached</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      You've used all available trades for this contest.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Trading Form */}
                    <div className="space-y-3">
                      {/* Lot Size Selection */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Lot Size</label>
                        <div className="grid grid-cols-3 gap-2">
                          {lotSizes.map((size) => (
                            <Button
                              key={size}
                              variant={selectedLotSize === size ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleLotSizeChange(size)}
                            >
                              {size}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Order Type */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Order Type</label>
                        <Select value={orderType} onValueChange={setOrderType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="market">Market</SelectItem>
                            <SelectItem value="limit">Limit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Quantity</label>
                        <Input
                          type="number"
                          value={orderQuantity}
                          onChange={(e) => setOrderQuantity(Number(e.target.value))}
                          min={1}
                          className="w-full"
                          placeholder="Enter quantity"
                        />
                      </div>
                      {/* Price (for limit orders) */}  
                      {orderType === "limit" && (
                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-2">Price</label>
                          <Input
                            type="number"
                            value={orderPrice}
                            onChange={(e) => setOrderPrice(Number(e.target.value))}
                            min={0}
                            className="w-full"
                            placeholder="Enter limit price"
                          />
                        </div>
                      )}
                    </div>
                    {/* Action Buttons with Loading State */}
                    <div className="flex gap-2">
                      <Button 
                        variant="primary" 
                        onClick={placeBuyOrder} 
                        disabled={isPlacingOrder || loading || orderQuantity <= 0 || tradeLimitReached}
                        className="flex-1"
                      >
                        {isPlacingOrder ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Buying...
                          </>
                        ) : (
                          'Buy'
                        )}
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={placeSellOrder} 
                        disabled={isPlacingOrder || loading || orderQuantity <= 0 || tradeLimitReached}
                        className="flex-1"
                      >
                        {isPlacingOrder ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Selling...
                          </>
                        ) : (
                          'Sell'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Trade History - Mobile Friendly */}
            <Card>
              <CardHeader className="p-3 sm:p-4">
                <CardTitle className="text-base sm:text-lg">Trade History</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                {trades.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-4">No trades yet.</div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {trades.map((trade) => (
                      <div key={trade.id} 
                        className={`flex items-center justify-between p-2 rounded text-xs sm:text-sm
                          ${trade.type === 'buy' ? 'bg-green-50' : 'bg-red-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${trade.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                            {trade.type.toUpperCase()}
                          </span>
                          <span>₹{trade.price.toFixed(2)}</span>
                          <span className="text-sm text-gray-500">{trade.quantity} lots</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>    
    </div>
  )
}
// Note: Ensure you have the necessary CSS styles for the components used in this file.