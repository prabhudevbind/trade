import { useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import { io } from 'socket.io-client';

export function usePriceStreams(realTimeData, setRealTimeData) {
  const socketRef = useRef(null);
  const dataUpdateQueue = useRef(new Map());
  const subscribedInstruments = useRef(new Set());

  useEffect(() => {
    if (!realTimeData?.leaderboard) return;

    // Get unique instruments from active positions
    const requiredInstruments = new Set();
    realTimeData.leaderboard.forEach(participant => {
      participant.activePositions?.forEach(position => {
        requiredInstruments.add(`NSE_FO|${position.symbol}`);
      });
    });

    // Connect to Socket.IO server if not already
    if (!socketRef.current) {
      socketRef.current = io('', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        autoConnect: true,
      });
    }
    const socket = socketRef.current;

    // Subscribe to new instruments
    requiredInstruments.forEach(instrumentKey => {
      if (!subscribedInstruments.current.has(instrumentKey)) {
        socket.emit('market:subscribe', instrumentKey);
        subscribedInstruments.current.add(instrumentKey);
      }
    });
    // Unsubscribe from instruments no longer needed
    Array.from(subscribedInstruments.current).forEach(instrumentKey => {
      if (!requiredInstruments.has(instrumentKey)) {
        socket.emit('market:unsubscribe', instrumentKey);
        subscribedInstruments.current.delete(instrumentKey);
      }
    });

    // Debounced update function to batch updates
    const debouncedUpdate = debounce(() => {
      if (dataUpdateQueue.current.size === 0) return;
      setRealTimeData(prevData => {
        if (!prevData?.leaderboard) return prevData;
        const updatedLeaderboard = prevData.leaderboard.map(participant => {
          let updatedUnrealizedPnL = 0;
          let updatedPositions = participant.activePositions?.map(position => {
            const newPrice = dataUpdateQueue.current.get(`NSE_FO|${position.symbol}`);
            if (newPrice !== undefined) {
              const positionPnL = (newPrice - position.averagePrice) * position.quantity;
              updatedUnrealizedPnL += positionPnL;
              return {
                ...position,
                currentPrice: newPrice,
                pnl: positionPnL
              };
            }
            updatedUnrealizedPnL += position.pnl || 0;
            return position;
          }) || [];
          // Calculate percentage P&L (ROI) for this participant
          const initialValue = (participant.virtualCash || 0) + (participant.activePositions?.reduce((sum, pos) => sum + (pos.averagePrice * pos.quantity), 0) || 0);
          const roi = initialValue > 0 ? (updatedUnrealizedPnL / initialValue) * 100 : 0;
          return {
            ...participant,
            activePositions: updatedPositions,
            unrealizedPnL: updatedUnrealizedPnL,
            totalPnL: updatedUnrealizedPnL + (participant.realizedPnL || 0),
            portfolioValue: (participant.virtualCash || 0) + updatedUnrealizedPnL + (participant.realizedPnL || 0),
            roi: roi
          };
        });
        // Sort and update ranks
        const sortedLeaderboard = updatedLeaderboard
          .sort((a, b) => b.portfolioValue - a.portfolioValue)
          .map((participant, index) => ({
            ...participant,
            rank: index + 1
          }));
        // Clear the update queue after processing
        dataUpdateQueue.current.clear();
        return {
          ...prevData,
          leaderboard: sortedLeaderboard,
          contestStats: {
            averageROI: sortedLeaderboard.reduce((sum, p) => sum + (p.roi || 0), 0) / sortedLeaderboard.length,
            highestPnL: Math.max(...sortedLeaderboard.map(p => p.totalPnL || 0)),
            totalTradingVolume: sortedLeaderboard.reduce((sum, p) => sum + (p.tradingStats?.totalTrades || 0), 0),
          }
        };
      });
    }, 1000);

    // Listen for market data updates
    const onMarketData = (data) => {
      if (!data || !data.instrumentKey) return;
      // Defensive: handle both .data.ff.marketFF.ltpc.ltp and .data.ltp
      const newLtp = data.data?.ff?.marketFF?.ltpc?.ltp ?? data.data?.ltp;
      if (newLtp !== undefined) {
        dataUpdateQueue.current.set(data.instrumentKey, newLtp);
        debouncedUpdate();
      }
    };
    socket.on('marketData', onMarketData);

    // Cleanup function
    return () => {
      socket.off('marketData', onMarketData);
      // Unsubscribe from all instruments
      Array.from(subscribedInstruments.current).forEach(instrumentKey => {
        socket.emit('market:unsubscribe', instrumentKey);
      });
      subscribedInstruments.current.clear();
      debouncedUpdate.cancel();
      // Optionally disconnect socket if you want to fully cleanup
      // socket.disconnect();
    };
  }, [realTimeData?.leaderboard]);
}
