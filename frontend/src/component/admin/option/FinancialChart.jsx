import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

const FinancialChart = () => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const eventSourceRef = useRef(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [candleCount, setCandleCount] = useState(0);
  const [formData, setFormData] = useState({
    instrumentKey: 'NSE_INDEX|Nifty 50',
    interval: 'day',
    toDate: '2025-05-15',
    fromDate: '2024-05-15',
  });

  // Initialize chart
  useEffect(() => {
    if (chartContainerRef.current && chartContainerRef.current.clientWidth) {
      if (chartRef.current) {
        chartRef.current.remove();
      }

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 500,
        layout: {
          background: { type: 'solid', color: '#ffffff' },
          textColor: '#333333',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' },
        },
        rightPriceScale: {
          borderColor: '#e0e0e0',
        },
        timeScale: {
          borderColor: '#e0e0e0',
          timeVisible: true,
          secondsVisible: formData.interval === '1minute',
        },
        crosshair: {
          mode: 1,
        },
      });

      chartRef.current = chart;

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
      });

      seriesRef.current = candlestickSeries;

      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      if (data.length > 0) {
        seriesRef.current.setData(data);
        chartRef.current.timeScale().fitContent();
      }

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [formData.interval]);

  // Process incoming candle data
  const processCandle = (candleData) => {
    try {
      let timestamp;
      
      // Handle different timestamp formats
      if (candleData.timestamp) {
        timestamp = new Date(candleData.timestamp).getTime() / 1000;
      } else {
        timestamp = Math.floor(Date.now() / 1000);
      }

      return {
        time: timestamp,
        open: parseFloat(candleData.open),
        high: parseFloat(candleData.high),
        low: parseFloat(candleData.low),
        close: parseFloat(candleData.close),
      };
    } catch (error) {
      console.error('Error processing candle data:', error);
      return null;
    }
  };

  // Handle SSE connection
  useEffect(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setLoading(true);
    setError(null);
    setConnectionStatus('connecting');
    setData([]);
    setCandleCount(0);

    const { instrumentKey, interval, toDate, fromDate } = formData;

    // Construct the SSE URL
    const url = `/api/v1/candles?instrument_key=${encodeURIComponent(
      instrumentKey
    )}&interval=${interval}&to_date=${toDate}&from_date=${fromDate}`;

    console.log('Connecting to SSE:', url);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connection opened');
      setLoading(false);
      setConnectionStatus('connected');
      setError(null);
    };

    eventSource.addEventListener('candle', (event) => {
      try {
        const candleData = JSON.parse(event.data);
        const processedCandle = processCandle(candleData);
        
        if (processedCandle) {
          setData((prevData) => {
            const existingIndex = prevData.findIndex(
              (item) => item.time === processedCandle.time
            );
            
            let newData;
            if (existingIndex !== -1) {
              // Update existing candle
              newData = [...prevData];
              newData[existingIndex] = processedCandle;
            } else {
              // Add new candle and sort by time
              newData = [...prevData, processedCandle].sort((a, b) => a.time - b.time);
            }
            return newData;
          });
          
          setCandleCount(prev => prev + 1);
        }
      } catch (err) {
        console.error('Error processing candle message:', err);
        setError('Error processing candle data: ' + err.message);
      }
    });

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle status messages
        if (message.message) {
          console.log('Server message:', message.message);
        } else {
          // Handle direct candle data
          const processedCandle = processCandle(message);
          if (processedCandle) {
            setData((prevData) => {
              const existingIndex = prevData.findIndex(
                (item) => item.time === processedCandle.time
              );
              
              let newData;
              if (existingIndex !== -1) {
                newData = [...prevData];
                newData[existingIndex] = processedCandle;
              } else {
                newData = [...prevData, processedCandle].sort((a, b) => a.time - b.time);
              }
              return newData;
            });
            
            setCandleCount(prev => prev + 1);
          }
        }
      } catch (err) {
        console.error('Error processing SSE message:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setConnectionStatus('error');
      setError('Connection to data stream failed. Please check your connection and try again.');
      setLoading(false);
    };

    return () => {
      console.log('Closing SSE connection');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnectionStatus('disconnected');
    };
  }, [formData]);

  // Update chart when data changes
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data);
      
      // Auto-fit content only if we have new data
      if (data.length > 0) {
        setTimeout(() => {
          chartRef.current?.timeScale().fitContent();
        }, 100);
      }
    }
  }, [data]);

  // Handle form input changes
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const from = new Date(formData.fromDate);
    const to = new Date(formData.toDate);
    
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      setError('Please enter valid dates.');
      return;
    }
    
    if (from > to) {
      setError('From date must be before to date.');
      return;
    }
    
    const daysDiff = (to - from) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      setError('Date range cannot exceed 1 year.');
      return;
    }
    
    setError(null);
  };

  // Disconnect handler
  const handleDisconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnectionStatus('disconnected');
    setLoading(false);
  };

  // Get connection status color
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Financial Chart Stream</h2>
        <div className="flex items-center space-x-4">
          <div className={`font-medium ${getStatusColor()}`}>
            Status: {connectionStatus}
          </div>
          {candleCount > 0 && (
            <div className="text-sm text-gray-600">
              Candles received: {candleCount}
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block mb-2 font-medium text-gray-700">Instrument:</label>
            <select
              name="instrumentKey"
              value={formData.instrumentKey}
              onChange={handleInputChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="NSE_INDEX|Nifty 50">Nifty 50</option>
              <option value="NSE_INDEX|Bank Nifty">Bank Nifty</option>
              <option value="NSE_INDEX|Nifty 100">Nifty 100</option>
            </select>
          </div>
          
          <div>
            <label className="block mb-2 font-medium text-gray-700">Interval:</label>
            <select
              name="interval"
              value={formData.interval}
              onChange={handleInputChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1minute">1 Minute</option>
              <option value="5minute">5 Minutes</option>
              <option value="15minute">15 Minutes</option>
              <option value="30minute">30 Minutes</option>
              <option value="1hour">1 Hour</option>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
          
          <div>
            <label className="block mb-2 font-medium text-gray-700">From Date:</label>
            <input
              type="date"
              name="fromDate"
              value={formData.fromDate}
              onChange={handleInputChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block mb-2 font-medium text-gray-700">To Date:</label>
            <input
              type="date"
              name="toDate"
              value={formData.toDate}
              onChange={handleInputChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex justify-start space-x-3 mt-4">
          <button
            onClick={handleSubmit}
            className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            disabled={loading || connectionStatus === 'connecting'}
          >
            {loading ? 'Connecting...' : 'Update Chart'}
          </button>
          
          {connectionStatus === 'connected' && (
            <button
              onClick={handleDisconnect}
              className="bg-red-600 text-white py-2 px-6 rounded-md hover:bg-red-700 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-700 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <span className="font-medium">Error:</span> {error}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div ref={chartContainerRef} className="w-full h-96" />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <div>
          Powered by TradingView Lightweight Charts | Data for {formData.instrumentKey.split('|')[1]}
        </div>
        {data.length > 0 && (
          <div>
            Total candles: {data.length} | Last update: {new Date().toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialChart;