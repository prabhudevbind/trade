import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart3, Clock, Users, Trophy, Loader2 } from 'lucide-react';
import { useGetMarketDataQuery, useCreateTradeMutation } from '@/store/api/contest';
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from 'react-router-dom';

const TradingPositions = () => {
  const [activeTab, setActiveTab] = useState('positions');
  const [selectedContest, setSelectedContest] = useState(null);
  const [data, setData] = useState();

  const { 
    data: tradingData, 
    isLoading, 
    isError, 
    error,
    refetch
  } = useGetMarketDataQuery();
  const [createTrade] = useCreateTradeMutation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && tradingData) {
      setData(tradingData);
    }
  }, [isLoading, tradingData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading positions...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="m-4">
        <CardContent className="p-6">
          <div className="text-red-500">
            Error loading trading data: {error?.data?.message || 'Something went wrong'}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tradingData?.currentTrading?.length) {
    return (
      <Card className="m-4">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-2" />
            <p>No active trading positions found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTotalPnL = () => {
    return tradingData.currentTrading.reduce((total, contest) => {
      return total + contest.positions.reduce((contestTotal, position) => {
        return contestTotal + position.pnl;
      }, 0);
    }, 0);
  };

  const PositionCard = ({selectedContest, position, onClose, onSell }) => {
    const [currentPrice, setCurrentPrice] = useState(position.currentPrice);
    const [pnl, setPnl] = useState(position.pnl);
    const eventSourceRef = useRef(null);

    useEffect(() => {
        console.log(selectedContest);
      // Setup real-time price updates
      const encodedKey = encodeURIComponent(position.symbol);
      eventSourceRef.current = new EventSource(`http://localhost:5001/stream/${encodedKey}`);

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.data?.ff?.marketFF?.ltpc?.ltp) {
            const newPrice = parseFloat(data.data.ff.marketFF.ltpc.ltp);
            setCurrentPrice(newPrice);
            
            // Calculate new P&L
            const newPnl = (newPrice - position.averagePrice) * position.quantity;
            setPnl(newPnl);
          }
        } catch (err) {
          console.error('Stream parsing error:', err);
        }
      };

      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
      };
    }, [position]);

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{position.symbol}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                position.optionType === 'CE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {position.optionType}
              </span>
            </div>
            <p className="text-sm text-gray-600">Strike: {formatCurrency(position.strikePrice)}</p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
            </p>
            <div className="flex items-center gap-1 justify-end">
              {pnl >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm text-gray-500">Live</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3 text-sm mb-4">
          <div>
            <p className="text-gray-500">Quantity</p>
            <p className="font-medium">{position.quantity}</p>
          </div>
          <div>
            <p className="text-gray-500">Avg Price</p>
            <p className="font-medium">{formatCurrency(position.averagePrice)}</p>
          </div>
          <div>
            <p className="text-gray-500">Current</p>
            <p className="font-medium animate-pulse">{formatCurrency(currentPrice)}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onClose(position)}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Close Position
          </button>
          <button
            onClick={() => onSell(position)}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Sell
          </button>
        </div>
      </div>
    );
  };

  const ContestCard = ({ contest }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">{contest.contestName}</h3>
          <p className="text-sm text-gray-600">Contest #{contest.contestId}</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${contest.virtualCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(contest.virtualCash)}
          </p>
          <p className="text-xs text-gray-500">Virtual Cash</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600 mb-1">Trades Used</p>
          <p className="text-lg font-semibold">{contest.usedTrades}/{contest.maxTrades}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(contest.usedTrades / contest.maxTrades) * 100}%` }}
            ></div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600 mb-1">Active Positions</p>
          <p className="text-lg font-semibold">{contest.positions.length}</p>
        </div>
      </div>

      {/* Add trade button and modify positions button layout */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/option-chain/${contest.contestId}`)}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center justify-center"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Trade Now
        </button>

        {contest.positions.length > 0 && (
          <button
            onClick={() => setSelectedContest(selectedContest === contest.contestId ? null : contest.contestId)}
            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            {selectedContest === contest.contestId ? 'Hide Positions' : 'View Positions'}
          </button>
        )}
      </div>

      {contest.positions.length > 0 && selectedContest === contest.contestId && (
        <div className="mt-4">
          {contest.positions.map(position => (
            <PositionCard 
            selectedContest={selectedContest}
              key={position.id} 
              position={position}
              onClose={handleClosePosition}
              onSell={handleSellPosition}
            />
          ))}
        </div>
      )}
    </div>
  );

  const RecentTradeCard = ({ trade }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              trade.action === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {trade.action.toUpperCase()}
            </span>
            <span className="text-sm text-gray-600">{trade.symbol || 'N/A'}</span>
          </div>
          <p className="text-sm text-gray-600">Strike: {formatCurrency(trade.strikePrice)}</p>
          <p className="text-sm text-gray-600">Qty: {trade.quantity}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{formatCurrency(trade.price)}</p>
          <p className="text-xs text-gray-500">{formatTime(trade.timestamp)}</p>
        </div>
      </div>
    </div>
  );

  const handleClosePosition = async (position) => {
    try {
      // Create opposite trade to close position
      await createTrade({
        contestId: position.contestParticipant.contest_id,
        optionId: position.option.id,
        action: position.quantity > 0 ? 'sell' : 'buy',
        quantity: Math.abs(position.quantity),
        price: position.currentPrice
      });

      // Refetch positions after trade
      refetch();
    } catch (error) {
      console.error('Failed to close position:', error);
    }
  };

  const handleSellPosition = async (position) => {
    try {
      // Create sell trade
      await createTrade({
        contestId: position.contestParticipant.contest_id,
        optionId: position.option.id,
        action: 'sell',
        quantity: position.quantity,
        price: position.currentPrice
      });

      // Refetch positions after trade
      refetch();
    } catch (error) {
      console.error('Failed to sell position:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto  sm:px-6 lg:px-8">
          <div className="py-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Trading Dashboard</h1>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5" />
                  <span className="text-sm opacity-90">Active Contests</span>
                </div>
                <p className="text-2xl font-bold">{tradingData.summary.activeContests}</p>
              </div>
              
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-5 w-5" />
                  <span className="text-sm opacity-90">Total Trades</span>
                </div>
                <p className="text-2xl font-bold">{tradingData.summary.totalTradesAllTime}</p>
              </div>
              
              <div className={`rounded-lg p-4 text-white ${getTotalPnL() >= 0 ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-sm opacity-90">Total P&L</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(getTotalPnL())}</p>
              </div>
              
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-sm opacity-90">Portfolio Value</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(tradingData.summary.currentTotalValue)}</p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('positions')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'positions'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Activity className="h-4 w-4 inline mr-2" />
                Positions
              </button>
              <button
                onClick={() => setActiveTab('trades')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'trades'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Clock className="h-4 w-4 inline mr-2" />
                Recent Trades
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto  sm:px-6 lg:px-8 py-6">
        {activeTab === 'positions' && (
          <div className="space-y-6">
            {tradingData.currentTrading.map(contest => (
              <ContestCard key={contest.contestId} contest={contest} />
            ))}
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="space-y-6">
            {tradingData.currentTrading.map(contest => (
              <div key={contest.contestId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {contest.contestName}
                </h3>
                {contest.recentTrades.length > 0 ? (
                  <div className="space-y-3">
                    {contest.recentTrades.map(trade => (
                      <RecentTradeCard key={trade.id} trade={trade} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No recent trades</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TradingPositions;