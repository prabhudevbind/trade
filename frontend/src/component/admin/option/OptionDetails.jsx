import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createChart } from 'lightweight-charts';

export default function OptionDetails() {
  const { optionId } = useParams();
  
  // State Management
  const [state, setState] = useState({
    interval: 'day',
    days: 30,
    chartData: [],
    volumeData: [],
    isLoading: false,
    error: null,
    dateRange: {
      from: null,
      to: null
    }
  });

  // Refs
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  // Transform API data
  const transformCandleData = (candles) => {
    if (!Array.isArray(candles)) return { candleData: [], volumeData: [] };
    
    return candles.reduce((acc, candle) => {
      const timestamp = Math.floor(new Date(candle.timestamp).getTime() / 1000);
      
      acc.candleData.push({
        time: timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      });

      acc.volumeData.push({
        time: timestamp,
        value: candle.volume,
        color: candle.close >= candle.open ? '#26a69a' : '#ef5350'
      });

      return acc;
    }, { candleData: [], volumeData: [] });
  };

  // Fetch Historical Data
  const fetchHistoricalData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - state.days);
      
      const toDateStr = toDate.toISOString().split('T')[0];
      const fromDateStr = fromDate.toISOString().split('T')[0];

      const response = await fetch(
        `/api/v1/historical-data/${encodeURIComponent(optionId)}?interval=${state.interval}&fromDate=${fromDateStr}&toDate=${toDateStr}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data.candles)) {
        const { candleData, volumeData } = transformCandleData(data.data.candles);
        setState(prev => ({
          ...prev,
          chartData: candleData,
          volumeData: volumeData,
          dateRange: {
            from: data.date_range.from,
            to: data.date_range.to
          }
        }));
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to load data: ${error.message}`
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        borderColor: '#D1D4DC',
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    window.addEventListener('resize', () => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    });

    fetchHistoricalData();

    return () => {
      chart.remove();
    };
  }, []);

  // Update Chart Data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    
    if (state.chartData.length > 0) {
      candleSeriesRef.current.setData(state.chartData);
      volumeSeriesRef.current.setData(state.volumeData);
      chartRef.current?.timeScale().fitContent();
    }
  }, [state.chartData, state.volumeData]);

  return (
    <div className="option-details-container">
      <div className="chart-header">
        <h2>Historical Data: {optionId}</h2>
        {state.dateRange.from && (
          <p className="date-range">
            Period: {state.dateRange.from} to {state.dateRange.to}
          </p>
        )}
      </div>
      
      {state.isLoading && <div className="loading">Loading historical data...</div>}
      {state.error && <div className="error">{state.error}</div>}
      
      <div ref={chartContainerRef} className="chart-container" />
      
      <style jsx>{`
        .option-details-container {
          padding: 20px;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .chart-header {
          margin-bottom: 20px;
        }
        
        .date-range {
          color: #666;
          font-size: 14px;
        }
        
        .chart-container {
          height: 500px;
          width: 100%;
        }
        
        .loading, .error {
          text-align: center;
          padding: 20px;
        }
        
        .error {
          color: #dc3545;
        }
      `}</style>
    </div>
  );
}