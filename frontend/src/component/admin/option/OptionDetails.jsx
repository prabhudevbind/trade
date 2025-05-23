import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useGetOptionDetailsQuery, useGetIntervalsQuery, useGetCurrentMarketDataQuery } from '@/store/api/options.api';
import axios from 'axios';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function OptionDetails() {
  const { optionId } = useParams(); // e.g., NSE_FO|58102
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const type = queryParams.get('type') || 'call';
  const strike = queryParams.get('strike') || '42500';
  const interval = queryParams.get('interval') || '1minute';
  const days = queryParams.get('days') || '30';

  const [realTimeData, setRealTimeData] = useState(null);
  const [tradeForm, setTradeForm] = useState({
    quantity: 1,
    orderType: 'buy',
    price: '',
  });
  const [tradeError, setTradeError] = useState(null);
  const [tradeSuccess, setTradeSuccess] = useState(null);
  const eventSourceRef = useRef(null);

  // Fetch historical and current market data
  const {
    data: optionDetails,
    error: optionDetailsError,
    isLoading: isLoadingOptionDetails,
  } = useGetOptionDetailsQuery({ instrument_key: optionId, interval, days, type, strike });

  // Fetch available intervals
  const { data: intervals, error: intervalsError } = useGetIntervalsQuery();

  // Fetch current market data
  const { data: currentMarketData, error: currentMarketError } = useGetCurrentMarketDataQuery({ instrument_key: optionId });

  // Set up SSE for real-time updates
  useEffect(() => {
    const connectSSE = () => {
      const eventSource = new EventSource(
        `http://localhost:5000/api/v1/option-details-stream/${optionId}?type=${type}&strike=${strike}&interval=${interval}&days=7`
      );
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'market_data' && data.success) {
            setRealTimeData(data.market_data);
          } else if (data.type === 'error') {
            console.error('SSE Error:', data.message);
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };

      eventSource.onerror = () => {
        console.error('Error connecting to real-time stream');
        eventSource.close();
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        console.log('SSE connection closed');
      }
    };
  }, [optionId, type, strike, interval]);

  // Handle trade form input changes
  const handleTradeInputChange = (e) => {
    const { name, value } = e.target;
    setTradeForm((prev) => ({ ...prev, [name]: value }));
  };

  // Handle trade submission
  const handleTradeSubmit = async (e) => {
    e.preventDefault();
    setTradeError(null);
    setTradeSuccess(null);

    try {
      const response = await axios.post(
        'http://localhost:5000/api/v1/trade',
        {
          instrument_key: optionId,
          type,
          strike,
          quantity: parseInt(tradeForm.quantity),
          order_type: tradeForm.orderType,
          price: parseFloat(tradeForm.price) || realTimeData?.ltp || currentMarketData?.market_data?.ltp,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`, // Adjust based on your auth mechanism
          },
        }
      );

      if (response.data.success) {
        setTradeSuccess('Trade placed successfully!');
        setTradeForm({ quantity: 1, orderType: 'buy', price: '' });
      } else {
        setTradeError(response.data.message || 'Failed to place trade');
      }
    } catch (err) {
      setTradeError(err.response?.data?.message || 'Error placing trade');
    }
  };

  // Prepare chart data
  const historicalData = optionDetails?.historical_data?.candles || [];
  const chartData = {
    labels: historicalData
      .map((candle) => new Date(candle.timestamp).toLocaleString())
      .concat(realTimeData ? [new Date(realTimeData.timestamp).toLocaleString()] : []),
    datasets: [
      {
        type: 'line',
        label: 'Price (Historical + Real-Time)',
        data: [
          ...historicalData.map((candle) => candle.close),
          realTimeData ? realTimeData.ltp : null,
        ].filter((val) => val !== null),
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        fill: false,
        tension: 0.1,
        pointRadius: (ctx) => (ctx.dataIndex === historicalData.length && realTimeData ? 5 : 3),
        pointBackgroundColor: (ctx) => (ctx.dataIndex === historicalData.length && realTimeData ? '#2196F3' : '#4CAF50'),
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `Price Chart for ${optionId} (${type}, Strike: ${strike})` },
    },
    scales: {
      x: { title: { display: true, text: 'Time' } },
      y: { title: { display: true, text: 'Price' } },
    },
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Option Details</h2>
      {isLoadingOptionDetails && <p>Loading...</p>}
      {optionDetailsError && (
        <p style={{ color: 'red' }}>
          <strong>Error:</strong> {optionDetailsError?.data?.message || 'Failed to fetch option details'}
        </p>
      )}
      {optionDetails && (
        <>
          <p><strong>Option ID:</strong> {optionDetails.instrument_info.instrument_key}</p>
          <p><strong>Type:</strong> {optionDetails.instrument_info.type}</p>
          <p><strong>Strike Price:</strong> {optionDetails.instrument_info.strike_price}</p>
          <p><strong>Interval:</strong> {optionDetails.instrument_info.interval}</p>
          <p><strong>Days Requested:</strong> {optionDetails.instrument_info.days_requested}</p>
          <p><strong>Total Candles:</strong> {optionDetails.data_summary.total_candles}</p>
          <p>
            <strong>Date Range:</strong> {optionDetails.data_summary.date_range.from} to{' '}
            {optionDetails.data_summary.date_range.to}
          </p>
        </>
      )}
      {currentMarketData?.success && (
        <div>
          <h3>Current Market Data</h3>
          <p><strong>Last Traded Price:</strong> {currentMarketData.market_data.ltp}</p>
          <p><strong>Volume:</strong> {currentMarketData.market_data.volume}</p>
          <p><strong>Open Interest:</strong> {currentMarketData.market_data.open_interest}</p>
          <p><strong>Last Updated:</strong> {new Date(currentMarketData.market_data.timestamp).toLocaleString()}</p>
        </div>
      )}
      {currentMarketError && (
        <p style={{ color: 'red' }}>
          <strong>Error:</strong> {currentMarketError?.data?.message || 'Failed to fetch current market data'}
        </p>
      )}
      {realTimeData && (
        <div>
          <h3>Real-Time Market Data</h3>
          <p><strong>Last Traded Price:</strong> {realTimeData.ltp}</p>
          <p><strong>Volume:</strong> {realTimeData.volume}</p>
          <p><strong>Open Interest:</strong> {realTimeData.open_interest}</p>
          <p><strong>Last Updated:</strong> {new Date(realTimeData.timestamp).toLocaleString()}</p>
        </div>
      )}
      {intervals && (
        <div>
          <h3>Available Intervals</h3>
          <ul>
            {Object.entries(intervals.available_intervals).map(([key, value]) => (
              <li key={key}>
                {value.name}: {value.description} (Max {value.max_duration_days} days)
              </li>
            ))}
          </ul>
        </div>
      )}
      {intervalsError && (
        <p style={{ color: 'red' }}>
          <strong>Error:</strong> {intervalsError?.data?.message || 'Failed to fetch intervals'}
        </p>
      )}
      <h3>Trade</h3>
      <form onSubmit={handleTradeSubmit} style={{ margin: '20px 0' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <label>Quantity:</label>
            <input
              type="number"
              name="quantity"
              value={tradeForm.quantity}
              onChange={handleTradeInputChange}
              min="1"
              required
              style={{ marginLeft: '10px', width: '100px' }}
            />
          </div>
          <div>
            <label>Order Type:</label>
            <select
              name="orderType"
              value={tradeForm.orderType}
              onChange={handleTradeInputChange}
              style={{ marginLeft: '10px', width: '100px' }}
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <div>
            <label>Price (optional):</label>
            <input
              type="number"
              name="price"
              value={tradeForm.price}
              onChange={handleTradeInputChange}
              placeholder={realTimeData?.ltp || currentMarketData?.market_data?.ltp || 'Market Price'}
              step="0.01"
              style={{ marginLeft: '10px', width: '120px' }}
            />
          </div>
          <button type="submit" style={{ padding: '5px 20px' }}>
            Place Trade
          </button>
        </div>
      </form>
      {tradeSuccess && <p style={{ color: 'green' }}>{tradeSuccess}</p>}
      {tradeError && <p style={{ color: 'red' }}>{tradeError}</p>}
      <h3>Price Chart</h3>
      <div style={{ height: '400px' }}>
        <Chart type="line" data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}