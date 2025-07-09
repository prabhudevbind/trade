const cron = require("node-cron");
const prisma = require("../utils/prisma");
const io = require("socket.io-client");

// Socket.IO client for real-time option data
let socketClient = null;
let optionChainData = new Map(); // Temporary storage for current session only
global.optionChainHistory = new Map(); // For tracking history of option chain data

// Initialize Socket.IO connection
function initializeSocketConnection() {
  if (socketClient) {
    socketClient.disconnect();
  }

  socketClient = io("http://localhost:5001", {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: 10,
    timeout: 5000,
    forceNew: true,
  });

  socketClient.on("connect", () => {
    // console.log("🟢 Socket connected for cron job");
  });

  socketClient.on("disconnect", () => {
    // console.log("🔴 Socket disconnected");
  });

  socketClient.on("optionChain:data", (data) => {
    // console.log("📊 Received option chain data");
    
    // Store the data properly
    const key = storeOptionChainData(data);
    
    // Log summary of received data
    if (data.option_chain && Array.isArray(data.option_chain)) {
      // console.log(`Received ${data.option_chain.length} strikes for ${key}`);
      // console.log(`Spot price: ${data.underlying_info?.spot_price || 'N/A'}`);
      
      // Log first few strikes as sample
      const sampleStrikes = data.option_chain.slice(0, 3);
      sampleStrikes.forEach(strike => {
        // console.log(`Strike ${strike.strike_price}: CE LTP=${strike.call_option?.ltp || 'N/A'}, PE LTP=${strike.put_option?.ltp || 'N/A'}`);
      });
    }
  });

  socketClient.on("error", (error) => {
    // console.error("❌ Socket error:", error);
  });

  return socketClient;
}

function getInitialCash() {
  return 100000;
}

// Enhanced function to store and manage option chain data
function storeOptionChainData(data) {
  // console.log("Storing option chain data...");
  
  // Create key from the data
  const key = `${data.underlying_info?.instrument_key || data.instrument_key}:${data.underlying_info?.expiry_date || data.expiry_date}`;
  
  // Store in memory
  optionChainData.set(key, data);
  
  // Also store with alternative key format for better matching
  if (data.underlying_info) {
    const altKey = data.underlying_info.instrument_key;
    optionChainData.set(altKey, data);
  }
  
  // console.log(`Stored option chain data with key: ${key}`);
  // console.log(`Total keys in memory: ${optionChainData.size}`);
  
  // Track history
  if (!global.optionChainHistory.has(key)) {
    global.optionChainHistory.set(key, []);
  }
  
  global.optionChainHistory.get(key).push({
    timestamp: data.timestamp || new Date().toISOString(),
    option_chain: data.option_chain
  });
  
  // Keep only last 20 snapshots
  if (global.optionChainHistory.get(key).length > 20) {
    global.optionChainHistory.get(key).shift();
  }
  
  return key;
}

// Fetch live LTP using Socket.IO real-time data
async function getLiveLTP(option) {
  // console.log("Getting LTP for option:", JSON.stringify(option, null, 2));

  // Create the key for this option's expiry
  const optionKey = `${option.instrumentExpiryKey}`;
  // console.log("Looking for option key:", optionKey);
  
  // Log all available keys in memory
  // console.log("Available keys in optionChainData:", Array.from(optionChainData.keys()));
  
  // Try to find the option chain data for this expiry
  let foundData = null;
  
  // Search through all stored option chain data
  for (const [key, data] of optionChainData.entries()) {
    // console.log(`Checking key: ${key}`);
    
    // Check if this key matches our option's instrument and expiry
    if (key.includes(option.instrumentExpiryKey) || 
        (data.underlying_info && data.underlying_info.instrument_key && 
         data.underlying_info.expiry_date && 
         key.includes(data.underlying_info.instrument_key))) {
      
      foundData = data;
      // console.log("Found matching data for key:", key);
      break;
    }
  }
  
  if (!foundData) {
    // console.log("No option chain data found for this expiry");
    return null;
  }
  
  // Now search through the option chain for the specific strike and type
  if (foundData.option_chain && Array.isArray(foundData.option_chain)) {
    // console.log(`Searching through ${foundData.option_chain.length} strikes`);
    
    for (const strike of foundData.option_chain) {
      // console.log(`Checking strike: ${strike.strike_price}`);
      
      // Match strike price
      if (strike.strike_price === parseInt(option.strike_price)) {
        // console.log("Strike price matched!");
        
        // Check for Call Option (CE)
        if (option.option_type === "CE" && strike.call_option) {
          // console.log("Found CE option:", strike.call_option);
          
          // Check if instrument_key matches
          if (strike.call_option.instrument_key === option.symbol) {
            const ltp = Number(strike.call_option.ltp || 0);
            // console.log(`Found matching CE LTP: ${ltp}`);
            return ltp;
          }
        }
        
        // Check for Put Option (PE)
        if (option.option_type === "PE" && strike.put_option) {
          // console.log("Found PE option:", strike.put_option);
          
          // Check if instrument_key matches
          if (strike.put_option.instrument_key === option.symbol) {
            const ltp = Number(strike.put_option.ltp || 0);
            // console.log(`Found matching PE LTP: ${ltp}`);
            return ltp;
          }
        }
      }
    }
  }
  
  // console.log("No matching option found in option chain");
  return null;
}
async function getLiveLTP(option) {
  // console.log("Getting LTP for option:", JSON.stringify(option, null, 2));

  // Create search keys - multiple formats for better matching
  const searchKeys = [
    `${option.instrumentExpiryKey}`, // Primary key (e.g., "NSE_INDEX|Nifty 50:2025-07-10")
    `${option.symbol}`,             // Just the instrument key (e.g., "NSE_INDEX|Nifty 50")
    `${option.symbol}:${option.expiry_date}` // Alternative format
  ];

  // console.log("Searching with keys:", searchKeys);
  // console.log("Available keys in optionChainData:", Array.from(optionChainData.keys()));

  // Try each search key until we find matching data
  let foundData = null;
  for (const key of searchKeys) {
    if (optionChainData.has(key)) {
      foundData = optionChainData.get(key);
      // console.log("Found data with key:", key);
      break;
    }
  }

  if (!foundData) {
    // console.log("No option chain data found for any search key");
    return null;
  }

  // Now search through the option chain for the specific strike and type
  if (!foundData.option_chain || !Array.isArray(foundData.option_chain)) {
    // console.log("No option chain array found in data");
    return null;
  }

  // console.log(`Searching through ${foundData.option_chain.length} strikes`);

  for (const strike of foundData.option_chain) {
    // Skip if strike doesn't match
    if (parseInt(strike.strike_price) !== parseInt(option.strike_price)) {
      continue;
    }

    // console.log("Strike price matched:", strike.strike_price);

    // Handle Call Option (CE)
    if (option.option_type === "CE" && strike.call_option) {
      // console.log("Checking CE option:", strike.call_option.instrument_key);
      
      // Match either by instrument_key or check if it's the correct strike
      if (strike.call_option.instrument_key === option.symbol || 
          strike.strike_price === parseInt(option.strike_price)) {
        const ltp = Number(strike.call_option.ltp || 0);
        // console.log(`Found matching CE LTP: ${ltp}`);
        return ltp;
      }
    }

    // Handle Put Option (PE)
    if (option.option_type === "PE" && strike.put_option) {
      // console.log("Checking PE option:", strike.put_option.instrument_key);
      
      // Match either by instrument_key or check if it's the correct strike
      if (strike.put_option.instrument_key === option.symbol || 
          strike.strike_price === parseInt(option.strike_price)) {
        const ltp = Number(strike.put_option.ltp || 0);
        // console.log(`Found matching PE LTP: ${ltp}`);
        return ltp;
      }
    }
  }

  // console.log("No matching option found in option chain");
  return null;
}

// Enhanced storeOptionChainData to better handle the incoming data structure
function storeOptionChainData(data) {
  if (!data || !data.underlying_info) {
    // console.log("Invalid option chain data received");
    return null;
  }

  const underlyingKey = data.underlying_info.instrument_key;
  const expiryDate = data.underlying_info.expiry_date;
  const spotPrice = data.underlying_info.spot_price;

  // Create multiple keys for flexible lookup
  const primaryKey = `${underlyingKey}:${expiryDate}`;
  const secondaryKey = underlyingKey;
  const timestampKey = `${underlyingKey}:${new Date().toISOString()}`;

  // console.log(`Storing option chain for ${primaryKey}, Spot: ${spotPrice}`);

  // Store with all key formats
  optionChainData.set(primaryKey, data);
  optionChainData.set(secondaryKey, data);
  optionChainData.set(timestampKey, data);

  // Track history
  if (!global.optionChainHistory.has(primaryKey)) {
    global.optionChainHistory.set(primaryKey, []);
  }

  // Keep only essential data in history to save memory
  const snapshot = {
    timestamp: data.timestamp || new Date().toISOString(),
    spot_price: spotPrice,
    strikes: data.option_chain.map(strike => ({
      strike_price: strike.strike_price,
      call_ltp: strike.call_option?.ltp,
      put_ltp: strike.put_option?.ltp
    }))
  };

  global.optionChainHistory.get(primaryKey).push(snapshot);

  // Keep only last 20 snapshots
  if (global.optionChainHistory.get(primaryKey).length > 20) {
    global.optionChainHistory.get(primaryKey).shift();
  }

  return primaryKey;
}

// Utility function to print option chain summary in readable format
function printOptionChainSummary(key) {
  const data = optionChainData.get(key);
  if (!data) {
    // console.log(`No data found for key: ${key}`);
    return;
  }

  const underlying = data.underlying_info;
  // console.log(`\n📊 Option Chain Summary for ${underlying.instrument_key} @ ${underlying.expiry_date}`);
  // console.log(`🕒 ${data.timestamp} | Spot: ${underlying.spot_price}`);
  // console.log("Strike   | CE LTP   | PE LTP   | CE OI    | PE OI    | PCR");
  // console.log("---------|----------|----------|----------|----------|----------");

  data.option_chain.slice(0, 10).forEach(strike => {
    const ce = strike.call_option || {};
    const pe = strike.put_option || {};
    // console.log(
    //   `${strike.strike_price.toString().padStart(7)} | ` +
    //   `${(ce.ltp || '-').toString().padStart(8)} | ` +
    //   `${(pe.ltp || '-').toString().padStart(8)} | ` +
    //   `${(ce.oi_quantity || '-').toString().padStart(8)} | ` +
    //   `${(pe.oi_quantity || '-').toString().padStart(8)} | ` +
    //   `${strike.pcr ? strike.pcr.toFixed(2) : '-'}`
    // );
  });

  if (data.summary) {
    // console.log("\n📈 Summary:");
    // console.log(`Total Strikes: ${data.summary.total_strikes}`);
    // console.log(`Call OI (lots): ${data.summary.total_call_oi_lots}`);
    // console.log(`Put OI (lots): ${data.summary.total_put_oi_lots}`);
    // console.log(`PCR: ${data.summary.overall_pcr}`);
  }
}
// Function to clear old data periodically
function clearOldOptionData() {
  // console.log("Clearing old option chain data...");
  
  // Keep only recent data (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  for (const [key, data] of optionChainData.entries()) {
    const dataTimestamp = new Date(data.timestamp || 0);
    if (dataTimestamp < fiveMinutesAgo) {
      optionChainData.delete(key);
      // console.log(`Deleted old data for key: ${key}`);
    }
  }
  
  // console.log(`Remaining keys in memory: ${optionChainData.size}`);
}

// Debug function to show what's in memory
function debugOptionChainData() {
  // console.log("\n=== DEBUG: Option Chain Data in Memory ===");
  // console.log(`Total keys: ${optionChainData.size}`);
  
  for (const [key, data] of optionChainData.entries()) {
    // console.log(`\nKey: ${key}`);
    // console.log(`Timestamp: ${data.timestamp}`);
    // console.log(`Underlying: ${data.underlying_info?.instrument_key || 'N/A'}`);
    // console.log(`Expiry: ${data.underlying_info?.expiry_date || 'N/A'}`);
    // console.log(`Spot: ${data.underlying_info?.spot_price || 'N/A'}`);
    // console.log(`Strikes: ${data.option_chain?.length || 0}`);
    
    if (data.option_chain && data.option_chain.length > 0) {
      // console.log("Sample strikes:");
      data.option_chain.slice(0, 2).forEach(strike => {
        // console.log(`  ${strike.strike_price}: CE=${strike.call_option?.ltp || 'N/A'} PE=${strike.put_option?.ltp || 'N/A'}`);
      });
    }
  }
  // console.log("=== END DEBUG ===\n");
}

function calculateRealizedPnL(trades) {
  let totalRealizedPnL = 0;

  const tradeGroups = new Map();

  trades.forEach((trade) => {
    const key = `${trade.option.symbol}_${trade.option.strike_price}_${trade.option.option_type}`;
    if (!tradeGroups.has(key)) {
      tradeGroups.set(key, []);
    }
    tradeGroups.get(key).push(trade);
  });

  tradeGroups.forEach((groupTrades) => {
    groupTrades.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let position = 0;
    let averageBuyPrice = 0;
    let instrumentPnL = 0;

    groupTrades.forEach((trade) => {
      const quantity = Math.abs(trade.quantity);
      const price = Number(trade.price);

      if (trade.action === "buy") {
        const newTotalQuantity = position + quantity;
        if (newTotalQuantity > 0) {
          averageBuyPrice =
            (position * averageBuyPrice + quantity * price) / newTotalQuantity;
        }
        position += quantity;
      } else if (trade.action === "sell") {
        if (position > 0) {
          const sellQuantity = Math.min(quantity, position);
          const pnl = sellQuantity * price - sellQuantity * averageBuyPrice;
          instrumentPnL += pnl;
          position -= sellQuantity;
        }
      }
    });

    totalRealizedPnL += instrumentPnL;
  });

  return totalRealizedPnL;
}

function calculateUnrealizedPnL(positions) {
  let totalUnrealizedPnL = 0;

  positions.forEach((pos) => {
    const currentLtp = Number(pos.option.ltp);
    const avgEntryPrice = Number(pos.average_entry_price);
    const netQuantity = Number(pos.net_quantity);

    if (netQuantity === 0) {
      return;
    }

    const positionPnL = (currentLtp - avgEntryPrice) * netQuantity;
    totalUnrealizedPnL += positionPnL;
  });

  return totalUnrealizedPnL;
}

let latestLeaderboardData = null;

async function generateLeaderboard() {
  // console.log("Starting leaderboard generation...");
  
  try {
    const activeContest = await prisma.contest.findFirst({
      where: { status: "ongoing" },
    });

    if (!activeContest) {
      // console.log("No active contest found");
      return null;
    }

    // console.log(`Found active contest: ${activeContest.id}`);

    const participants = await prisma.contestParticipant.findMany({
      where: { contest_id: activeContest.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            img: true,
          },
        },
        positions: {
          where: { net_quantity: { not: 0 } },
          include: { option: true },
        },
        trades: {
          include: { option: true },
          orderBy: { timestamp: "desc" },
        },
      },
    });

    // console.log(`Found ${participants.length} participants`);

    const leaderboard = [];

    // Get unique instrumentExpiryKeys to subscribe to
    const subscriptions = new Set();
    participants.forEach(participant => {
      participant.positions.forEach(pos => {
        if (pos.option.instrumentExpiryKey) {
          subscriptions.add(pos.option.instrumentExpiryKey);
        }
      });
    });

    // Subscribe to all required option chains
    if (socketClient && socketClient.connected) {
      subscriptions.forEach(sub => {
        const [instrument_key, expiry_date] = sub.split(':');
        socketClient.emit("optionChain:subscribe", {
          instrument_key,
          expiry_date,
        });
      });
      
      // Wait for data to arrive
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    for (const participant of participants) {
      // console.log(`Processing participant: ${participant.user.username}`);
      
      const positionsWithLive = [];
      for (const pos of participant.positions) {
        const liveLtp = await getLiveLTP(pos.option);
        positionsWithLive.push({
          ...pos,
          option: { ...pos.option, ltp: liveLtp },
        });
      }

      const realizedPnL = calculateRealizedPnL(participant.trades);
      const unrealizedPnL = calculateUnrealizedPnL(positionsWithLive);
      const totalPnL = realizedPnL + unrealizedPnL;

      const initialCash = getInitialCash();
      const portfolioValue = initialCash + totalPnL;
      const roi = initialCash > 0 ? (totalPnL / initialCash) * 100 : 0;

      leaderboard.push({
        userId: participant.user.id,
        userName: participant.user.username,
        userImg: participant.user.img,
        virtualCash: Number(participant.virtual_cash) || 0,
        unrealizedPnL: unrealizedPnL,
        realizedPnL: realizedPnL,
        totalPnL: totalPnL,
        portfolioValue: portfolioValue,
        roi: roi,
        totalTrades: participant.trades?.length || 0,
        openPositions: positionsWithLive.length,
        profitLossStatus:
          totalPnL > 0 ? "PROFIT" : totalPnL < 0 ? "LOSS" : "BREAKEVEN",
        lastUpdated: new Date().toISOString(),
      });
    }

    // Sort leaderboard by total P&L in descending order
    leaderboard.sort((a, b) => b.totalPnL - a.totalPnL);

    // Assign ranks
    leaderboard.forEach((participant, index) => {
      participant.rank = index + 1;
    });

    // Generate summaries
    const strikesSummary = new Map();
    const ratesSummary = new Map();

    for (const participant of participants) {
      for (const pos of participant.positions) {
        const key = `${pos.option.symbol}_${pos.option.strike_price}_${pos.option.option_type}`;
        if (!strikesSummary.has(key)) {
          strikesSummary.set(key, {
            symbol: pos.option.symbol,
            strike: pos.option.strike_price,
            type: pos.option.option_type,
            positions: 0,
            totalQuantity: 0,
            avgLtp: 0,
            ltpSum: 0,
            ltpCount: 0,
          });
        }

        const summary = strikesSummary.get(key);
        summary.positions++;
        summary.totalQuantity += Math.abs(pos.net_quantity);
        summary.ltpSum += pos.option.ltp;
        summary.ltpCount++;
        summary.avgLtp = summary.ltpSum / summary.ltpCount;

        const rateKey = pos.option.symbol;
        if (!ratesSummary.has(rateKey)) {
          ratesSummary.set(rateKey, {
            symbol: pos.option.symbol,
            totalPositions: 0,
            callPositions: 0,
            putPositions: 0,
            avgCallLtp: 0,
            avgPutLtp: 0,
            callLtpSum: 0,
            putLtpSum: 0,
            callCount: 0,
            putCount: 0,
          });
        }

        const rateSummary = ratesSummary.get(rateKey);
        rateSummary.totalPositions++;

        if (pos.option.option_type === "CE") {
          rateSummary.callPositions++;
          rateSummary.callLtpSum += pos.option.ltp;
          rateSummary.callCount++;
          rateSummary.avgCallLtp =
            rateSummary.callLtpSum / rateSummary.callCount;
        } else if (pos.option.option_type === "PE") {
          rateSummary.putPositions++;
          rateSummary.putLtpSum += pos.option.ltp;
          rateSummary.putCount++;
          rateSummary.avgPutLtp = rateSummary.putLtpSum / rateSummary.putCount;
        }
      }
    }

    const leaderboardData = {
      contest_id: activeContest.id,
      snapshot_time: new Date(),
      total_participants: leaderboard.length,
      leaderboard: leaderboard,
      strikes_summary: Array.from(strikesSummary.entries()),
      rates_summary: Array.from(ratesSummary.entries()),
    };

    // Update the in-memory variable
    latestLeaderboardData = leaderboardData;

    // Emit to WebSocket if available
    if (global.io) {
      global.io.emit("leaderboardUpdate", leaderboardData);
      // console.log("Leaderboard broadcasted via WebSocket");
    }

    // Save to database
    for (const participant of leaderboard) {
      try {
        await prisma.leaderboard.upsert({
          where: {
            contest_id_user_id_snapshot_time: {
              contest_id: activeContest.id,
              user_id: participant.userId,
              snapshot_time: leaderboardData.snapshot_time,
            },
          },
          update: {
            rank: participant.rank,
            portfolio_value: participant.portfolioValue,
            total_pnl: participant.totalPnL,
            unrealized_pnl: participant.unrealizedPnL,
            realized_pnl: participant.realizedPnL,
            roi: participant.roi,
            virtual_cash: participant.virtualCash,
            profit_loss_status: participant.profitLossStatus,
            snapshot_time: leaderboardData.snapshot_time,
          },
          create: {
            contest_id: activeContest.id,
            user_id: participant.userId,
            rank: participant.rank,
            portfolio_value: participant.portfolioValue,
            total_pnl: participant.totalPnL,
            unrealized_pnl: participant.unrealizedPnL,
            realized_pnl: participant.realizedPnL,
            roi: participant.roi,
            virtual_cash: participant.virtualCash,
            profit_loss_status: participant.profitLossStatus,
            snapshot_time: leaderboardData.snapshot_time,
          },
        });
      } catch (dbError) {
        // console.error(`Error saving leaderboard for user ${participant.userId}:`, dbError);
      }
    }

    // console.log(`Leaderboard generation completed. Total participants: ${leaderboard.length}`);
    return leaderboardData;
  } catch (error) {
    // console.error("Error generating leaderboard:", error);
    throw error;
  }
}

// Get leaderboard data from memory
async function getLeaderboardData(contestId) {
  if (
    latestLeaderboardData &&
    latestLeaderboardData.contest_id == contestId
  ) {
    return latestLeaderboardData;
  }
  return null;
}

function getMarketStatus() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const day = now.getDay();

  const isWeekday = day >= 1 && day <= 5;
  const isMarketTime =
    (hours === 9 && minutes >= 15) ||
    (hours > 9 && hours < 15) ||
    (hours === 15 && minutes <= 30);

  if (isWeekday && isMarketTime) {
    return "MARKET_OPEN";
  } else if (isWeekday && ((hours === 9 && minutes < 15) || hours < 9)) {
    return "PRE_MARKET";
  } else if (isWeekday && hours > 15) {
    return "POST_MARKET";
  } else {
    return "MARKET_CLOSED";
  }
}

async function triggerLeaderboardGeneration() {
  // console.log("Manual leaderboard generation triggered");
  return await generateLeaderboard();
}

// Function to print a summary of the latest option prices for all strikes
function printOptionChainSummary(key) {
  const data = optionChainData.get(key);
  if (!data || !data.option_chain) return;
  // console.log(`\nOption Chain Summary for ${key} (Spot: ${data.underlying_info?.spot_price || "-"})`);
  // console.log("Strike\tCE LTP\tPE LTP\tCE Vol\tPE Vol\tCE OI\tPE OI");
  data.option_chain.forEach(strike => {
    const ce = strike.call_option || {};
    const pe = strike.put_option || {};
    // console.log(`${strike.strike_price}\t${ce.ltp ?? "-"}\t${pe.ltp ?? "-"}\t${ce.volume ?? "-"}\t${pe.volume ?? "-"}\t${ce.oi_quantity ?? "-"}\t${pe.oi_quantity ?? "-"}`);
  });
}

// Function to print a table of option symbol, buy price, and current market price (live) for traded options only
function printOptionBuyVsMarketTable(participants) {
  const rows = [];
  participants.forEach(participant => {
    // Collect unique traded option keys for this participant
    const tradedOptionKeys = new Set();
    participant.trades.forEach(trade => {
      if (trade.option) {
        const key = `${trade.option.symbol}_${trade.option.strike_price}_${trade.option.option_type}`;
        tradedOptionKeys.add(key);
      }
    });
    // For each open position, print only if it was traded
    participant.positions.forEach(pos => {
      const key = `${pos.option.symbol}_${pos.option.strike_price}_${pos.option.option_type}`;
      if (tradedOptionKeys.has(key)) {
        const symbol = pos.option.symbol;
        const strike = pos.option.strike_price;
        const type = pos.option.option_type;
        const buyPrice = Number(pos.average_entry_price);
        const livePrice = Number(pos.option.ltp);
        rows.push({
          symbol: `${symbol} ${strike} ${type}`,
          buyPrice,
          livePrice
        });
      }
    });
  });
  if (rows.length === 0) {
    // console.log("No traded open positions to display.");
    return;
  }
  // console.log("\nOption Symbol         | Buy Price   | Market Price (Live)");
  // console.log("----------------------|-------------|---------------------");
  rows.forEach(row => {
    // console.log(
    //   `${row.symbol.padEnd(22)}| ${row.buyPrice.toFixed(2).padEnd(11)}| ${row.livePrice.toFixed(2).padEnd(19)}`
    // );
  });
}

// Initialize socket connection
initializeSocketConnection();

// Schedule the cron job to run every 1 minute
cron.schedule("*/1 * * * *", async () => {
  // console.log("Cron job triggered - generating leaderboard...");
  try {
    const marketStatus = getMarketStatus();
    // console.log(`Market status: ${marketStatus}`);
    
    // Clear old data first
    clearOldOptionData();
    
    // Generate leaderboard with real-time Socket.IO data
    await generateLeaderboard();
    // console.log("Leaderboard generation completed successfully");
  } catch (error) {
    // console.error("Error in scheduled leaderboard generation:", error);
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  // console.log("Received SIGTERM, shutting down gracefully...");
  try {
    if (socketClient) {
      socketClient.disconnect();
      // console.log("Socket.IO client disconnected");
    }
    optionChainData.clear();
  } catch (error) {
    // console.error("Error during shutdown:", error);
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  // console.log("Received SIGINT, shutting down gracefully...");
  try {
    if (socketClient) {
      socketClient.disconnect();
      // console.log("Socket.IO client disconnected");
    }
    optionChainData.clear();
  } catch (error) {
    // console.error("Error during shutdown:", error);
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  // console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  // console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

console.log("Leaderboard cron job service started with Socket.IO real-time data");

module.exports = {
  generateLeaderboard,
  triggerLeaderboardGeneration,
  getLeaderboardData,
  getMarketStatus,
  socketClient,
  debugOptionChainData,
  printOptionChainSummary,
  printOptionBuyVsMarketTable,
  clearOldOptionData,
};