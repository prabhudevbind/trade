import { useRef, useEffect } from 'react';
import { debounce } from 'lodash';

export function usePriceStreams(realTimeData, setRealTimeData) {
  const activeStreamsRef = useRef(new Map());
  const dataUpdateQueue = useRef(new Map());

  useEffect(() => {
    if (!realTimeData?.leaderboard) return;

    // Get unique instruments from active positions
    const requiredInstruments = new Set();
    realTimeData.leaderboard.forEach(participant => {
      participant.activePositions?.forEach(position => {
        requiredInstruments.add(`NSE_FO|${position.symbol}`);
      });
    });

    // Clean up unused streams
    activeStreamsRef.current.forEach((es, key) => {
      if (!requiredInstruments.has(key)) {
        es.close();
        activeStreamsRef.current.delete(key);
        dataUpdateQueue.current.delete(key);
      }
    });

    // Debounced update function to batch updates
    const debouncedUpdate = debounce(() => {
      if (dataUpdateQueue.current.size === 0) return;

      setRealTimeData(prevData => {
        if (!prevData?.leaderboard) return prevData;

        const updatedLeaderboard = prevData.leaderboard.map(participant => {
          let updatedUnrealizedPnL = 0;
          
          const updatedPositions = participant.activePositions?.map(position => {
            const newPrice = dataUpdateQueue.current.get(`NSE_FO|${position.symbol}`);
            if (newPrice) {
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

          return {
            ...participant,
            activePositions: updatedPositions,
            unrealizedPnL: updatedUnrealizedPnL,
            totalPnL: updatedUnrealizedPnL + (participant.realizedPnL || 0),
            portfolioValue: (participant.virtualCash || 0) + updatedUnrealizedPnL + (participant.realizedPnL || 0)
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
            totalTradingVolume: sortedLeaderboard.reduce((sum, p) => 
              sum + (p.tradingStats?.totalTrades || 0), 0
            ),
          }
        };
      });
    }, 1000); // Debounce updates to once per second

    // Setup stream handlers
    const setupStreamHandlers = (es, instrumentKey) => {
      let reconnectAttempts = 0;
      const MAX_RECONNECT_ATTEMPTS = 3;

      es.onopen = () => {
        console.log(`Stream connected for ${instrumentKey}`);
        reconnectAttempts = 0;
      };

      es.onerror = (error) => {
        console.error(`Stream error for ${instrumentKey}:`, error);
        es.close();
        activeStreamsRef.current.delete(instrumentKey);

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          setTimeout(() => {
            if (!activeStreamsRef.current.has(instrumentKey)) {
              const newEs = new EventSource(`http://localhost:5001/stream/${instrumentKey}`);
              activeStreamsRef.current.set(instrumentKey, newEs);
              setupStreamHandlers(newEs, instrumentKey);
            }
          }, 5000);
        }
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data.data?.ff?.marketFF?.ltpc?.ltp) return;

          const newLtp = data.data.ff.marketFF.ltpc.ltp;
          dataUpdateQueue.current.set(instrumentKey, newLtp);
          debouncedUpdate();
        } catch (error) {
          console.error(`Error processing message for ${instrumentKey}:`, error);
        }
      };
    };

    // Create new streams for required instruments
    requiredInstruments.forEach(instrumentKey => {
      if (!activeStreamsRef.current.has(instrumentKey)) {
        const es = new EventSource(`http://localhost:5001/stream/${instrumentKey}`);
        activeStreamsRef.current.set(instrumentKey, es);
        setupStreamHandlers(es, instrumentKey);
      }
    });

    // Cleanup function
    return () => {
      activeStreamsRef.current.forEach(es => {
        es.close();
      });
      activeStreamsRef.current.clear();
      dataUpdateQueue.current.clear();
      debouncedUpdate.cancel();
    };
  }, [realTimeData?.leaderboard]); // Only re-run when leaderboard data changes
}
