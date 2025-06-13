const prisma = require("../utils/prisma");

// Contest Controller
const contestController = {
  // Create a new contest
  async createContest(req, res) {
    try {
      const {
        name,
        start_time,
        end_time,
        entry_fee,
        maxTrade,
        status,
        trading_instrument,
      } = req.body;
      const contest = await prisma.contest.create({
        data: {
          name,
          start_time: new Date(start_time),
          end_time: new Date(end_time),
          maxTrade: maxTrade,
          entry_fee: parseFloat(entry_fee),
          status: status || "upcoming",
          trading_instrument: trading_instrument || "BOTH",
        },
      });
      res.status(201).json(contest);
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to create contest", details: error.message });
    }
  },

  // Get all contests
  async getAllContests(req, res) {
    try {
      const userId = parseInt(req.user.userId);

      // Get all contests with participant info for the current user
      const contests = await prisma.contest.findMany({
        include: {
          contestParticipants: {
            where: {
              user_id: userId,
            },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          contestWinners: {
            where: {
              user_id: userId,
            },
          },
          _count: {
            select: {
              contestParticipants: true,
            },
          },
        },
      });

      // Format response
      const formattedContests = contests.map((contest) => ({
        id: contest.id,
        name: contest.name,
        startTime: contest.start_time,
        endTime: contest.end_time,
        entryFee: parseFloat(contest.entry_fee),
        maxTrade: contest.maxTrade,
        status: contest.status,
        tradingInstrument: contest.trading_instrument,
        totalParticipants: contest._count.contestParticipants,
        hasJoined: contest.contestParticipants.length > 0,
        userParticipation: contest.contestParticipants[0] || null,
        userWinning: contest.contestWinners[0] || null,
      }));

      res.status(200).json({
        success: true,
        count: contests.length,
        contests: formattedContests,
      });
    } catch (error) {
      console.error("Error fetching contests:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch contests",
        details: error.message,
      });
    }
  },

  // Get a single contest by ID
  async getContestById(req, res) {
    try {
      const { id } = req.params;
      const userId = parseInt(req.user.userId);

      const contest = await prisma.contest.findUnique({
        where: { 
          id: parseInt(id) 
        },
        include: { 
          contestParticipants: {
            where: {
              user_id: userId
            },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              },
              positions: {
                include: {
                  option: true
                }
              },
              trades: {
                include: {
                  option: true
                },
                orderBy: {
                  timestamp: 'desc'
                }
              }
            }
          },
          contestWinners: {
            where: {
              user_id: userId
            }
          },
          _count: {
            select: {
              contestParticipants: true
            }
          }
        }
      });

      if (!contest) {
        return res.status(404).json({ error: "Contest not found" });
      }

      // Format response
      const formattedContest = {
        id: contest.id,
        name: contest.name,
        startTime: contest.start_time,
        endTime: contest.end_time,
        entryFee: parseFloat(contest.entry_fee),
        maxTrade: contest.maxTrade,
        status: contest.status,
        tradingInstrument: contest.trading_instrument,
        totalParticipants: contest._count.contestParticipants,
        participation: contest.contestParticipants[0] ? {
          id: contest.contestParticipants[0].id,
          virtualCash: parseFloat(contest.contestParticipants[0].virtual_cash),
          trades_taken: contest.contestParticipants[0].trades.length,
          positions: contest.contestParticipants[0].positions.map(pos => ({
            id: pos.id,
            symbol: pos.option.symbol,
            strikePrice: parseFloat(pos.option.strike_price),
            optionType: pos.option.option_type,
            quantity: pos.net_quantity,
            averagePrice: parseFloat(pos.average_entry_price),
            currentPrice: parseFloat(pos.option.ltp),
            pnl: (parseFloat(pos.option.ltp) - parseFloat(pos.average_entry_price)) * pos.net_quantity
          })),
          recentTrades: contest.contestParticipants[0].trades.slice(0, 5).map(trade => ({
            id: trade.id,
            timestamp: trade.timestamp,
            action: trade.action,
            symbol: trade.option.symbol,
            strikePrice: parseFloat(trade.option.strike_price),
            quantity: trade.quantity,
            price: parseFloat(trade.price)
          }))
        } : null,
        winning: contest.contestWinners[0] || null
      };

      res.status(200).json({
        success: true,
        contest: formattedContest
      });

    } catch (error) {
      console.error("Error fetching contest:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch contest", 
        details: error.message 
      });
    }
  },

  // Update a contest
  async updateContest(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        start_time,
        end_time,
        entry_fee,
        maxTrade,
        status,
        trading_instrument,
      } = req.body;
      const contest = await prisma.contest.update({
        where: { id: parseInt(id) },
        data: {
          name,
          start_time: start_time ? new Date(start_time) : undefined,
          end_time: end_time ? new Date(end_time) : undefined,
          maxTrade: maxTrade,
          entry_fee: entry_fee ? parseFloat(entry_fee) : undefined,
          status,
          trading_instrument,
        },
      });
      res.status(200).json(contest);
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to update contest", details: error.message });
    }
  },

  // Delete a contest
  async deleteContest(req, res) {
    try {
      const { id } = req.params;
      await prisma.contest.delete({
        where: { id: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to delete contest", details: error.message });
    }
  },
};

// ContestParticipant Controller
const contestParticipantController = {
  // Create a new contest participant
  async createContestParticipant(req, res) {
    try {
      const {  contest_id, virtual_cash } = req.body;
      let user_id=req.user.userId;
      const participant = await prisma.contestParticipant.create({
        data: {
          user_id: parseInt(user_id),
          contest_id: parseInt(contest_id),
          virtual_cash: parseFloat(virtual_cash) || 100000.0,
        },
      });
      res.status(201).json(participant);
    } catch (error) {
      res
        .status(400)
        .json({
          error: "Failed to create participant",
          details: error.message,
        });
    }
  },

  // Get all contest participants
  async getAllContestParticipants(req, res) {
    try {
      const userId = parseInt(req.user.userId);

      const participants = await prisma.contestParticipant.findMany({
        where: {
          user_id: userId
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            }
          },
          contest: {
            select: {
              name: true,
              start_time: true,
              end_time: true,
              entry_fee: true,
              maxTrade: true,
              status: true,
              trading_instrument: true
            }
          },
          positions: {
            include: {
              option: true
            }
          },
          trades: {
            include: {
              option: true
            },
            orderBy: {
              timestamp: 'desc'
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      // Format the response
      const formattedParticipants = participants.map(participant => ({
        id: participant.id,
        contestInfo: {
          id: participant.contest_id,
          name: participant.contest.name,
          status: participant.contest.status,
          startTime: participant.contest.start_time,
          endTime: participant.contest.end_time,
          tradingInstrument: participant.contest.trading_instrument,
          maxTrades: parseInt(participant.contest.maxTrade),
          entryFee: parseFloat(participant.contest.entry_fee)
        },
        userInfo: {
          name: `${participant.user.firstName} ${participant.user.lastName}`,
          email: participant.user.email
        },
        tradingInfo: {
          virtualCash: parseFloat(participant.virtual_cash),
          tradesUsed: participant.trades.length,
          tradesRemaining: parseInt(participant.contest.maxTrade) - participant.trades.length,
          positions: participant.positions.map(pos => ({
            id: pos.id,
            symbol: pos.option.symbol,
            strikePrice: parseFloat(pos.option.strike_price),
            optionType: pos.option.option_type,
            quantity: pos.net_quantity,
            averagePrice: parseFloat(pos.average_entry_price),
            currentPrice: parseFloat(pos.option.ltp),
            pnl: (parseFloat(pos.option.ltp) - parseFloat(pos.average_entry_price)) * pos.net_quantity
          })),
          recentTrades: participant.trades.slice(0, 5).map(trade => ({
            id: trade.id,
            timestamp: trade.timestamp,
            action: trade.action,
            symbol: trade.option.symbol,
            strikePrice: parseFloat(trade.option.strike_price),
            quantity: trade.quantity,
            price: parseFloat(trade.price)
          }))
        },
        created_at: participant.created_at,
        updated_at: participant.updated_at
      }));

      res.status(200).json({
        success: true,
        count: participants.length,
        participants: formattedParticipants
      });

    } catch (error) {
      console.error('Error fetching participants:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch participants',
        details: error.message
      });
    }
  },

  // Get a single contest participant by ID
  async getContestParticipantById(req, res) {
    try {
      const id=req.user.userId;
      const participant = await prisma.contestParticipant.findMany({
        where: { user_id: parseInt(id) },
        include: { user: true, contest: true, positions: true, trades: true },
      });
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      res.status(200).json(participant);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch participant", details: error.message });
    }
  },

  // Update a contest participant
  async updateContestParticipant(req, res) {
    try {
      const { id } = req.params;
      const { virtual_cash } = req.body;
      const participant = await prisma.contestParticipant.update({
        where: { id: parseInt(id) },
        data: {
          virtual_cash: virtual_cash ? parseFloat(virtual_cash) : undefined,
        },
      });
      res.status(200).json(participant);
    } catch (error) {
      res
        .status(400)
        .json({
          error: "Failed to update participant",
          details: error.message,
        });
    }
  },

  // Delete a contest participant
  async deleteContestParticipant(req, res) {
    try {
      const { id } = req.params;
      await prisma.contestParticipant.delete({
        where: { id: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res
        .status(400)
        .json({
          error: "Failed to delete participant",
          details: error.message,
        });
    }
  },

  // Get user trading data
  async getUserTradingData(req, res) {
    try {
      const userId = parseInt(req.user.userId);

      // Get current active contests data
      const currentContestData = await prisma.contestParticipant.findMany({
        where: {
          user_id: userId,
          contest: {
            status: "ongoing",
          },
        },
        include: {
          contest: true,
          trades: {
            include: {
              option: true,
            },
            orderBy: {
              timestamp: "desc",
            },
          },
          positions: {
            include: {
              option: true,
            },
          },
        },
      });

      // Get historical/past contests data
      const historicalContestData = await prisma.contestParticipant.findMany({
        where: {
          user_id: userId,
          contest: {
            status: {
              in: ["ended"],
            },
          },
        },
        include: {
          contest: true,
          trades: {
            include: {
              option: true,
            },
            orderBy: {
              timestamp: "desc",
            },
          },
          positions: {
            include: {
              option: true,
            },
          },
        },
      });

      // Format response data
      const response = {
        currentTrading: currentContestData.map((participant) => ({
          contestId: participant.contest_id,
          contestName: participant.contest.name,
          virtualCash: parseFloat(participant.virtual_cash),
          maxTrades: parseInt(participant.contest.maxTrade),
          usedTrades: participant.trades.length,
          positions: participant.positions.map((pos) => ({
            id: pos.id,
            symbol: pos.option.symbol,
            strikePrice: parseFloat(pos.option.strike_price),
            optionType: pos.option.option_type,
            quantity: pos.net_quantity,
            averagePrice: parseFloat(pos.average_entry_price),
            currentPrice: parseFloat(pos.option.ltp),
            pnl: (pos.option.ltp - pos.average_entry_price) * pos.net_quantity,
          })),
          recentTrades: participant.trades.slice(0, 5).map((trade) => ({
            id: trade.id,
            timestamp: trade.timestamp,
            action: trade.action,
            symbol: trade.option.symbol,
            strikePrice: parseFloat(trade.option.strike_price),
            quantity: trade.quantity,
            price: parseFloat(trade.price),
          })),
      })),

        tradingHistory: historicalContestData.map((participant) => ({
          contestId: participant.contest_id,
          contestName: participant.contest.name,
          endedAt: participant.contest.end_time,
          finalCash: parseFloat(participant.virtual_cash),
          totalTrades: participant.trades.length,
          positions: participant.positions.map((pos) => ({
            symbol: pos.option.symbol,
            strikePrice: parseFloat(pos.option.strike_price),
            optionType: pos.option.option_type,
            quantity: pos.net_quantity,
            averagePrice: parseFloat(pos.average_entry_price),
            lastPrice: parseFloat(pos.option.ltp),
            realizedPnl:
              (pos.option.ltp - pos.average_entry_price) * pos.net_quantity,
          })),
          tradeHistory: participant.trades.map((trade) => ({
            timestamp: trade.timestamp,
            action: trade.action,
            symbol: trade.option.symbol,
            strikePrice: parseFloat(trade.option.strike_price),
            quantity: trade.quantity,
            price: parseFloat(trade.price),
          })),
      })),

        summary: {
          activeContests: currentContestData.length,
          completedContests: historicalContestData.length,
          totalTradesAllTime: [
            ...currentContestData,
            ...historicalContestData,
          ].reduce((sum, contest) => sum + contest.trades.length, 0),
          currentTotalValue: currentContestData.reduce(
            (sum, contest) => sum + parseFloat(contest.virtual_cash),
            0
          ),
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error fetching user trading data:", error);
      res.status(500).json({
        error: "Failed to fetch trading data",
        details: error.message,
      });
    }
  },
};

// Option Controller
const optionController = {
  // Create a new option
  async createOption(req, res) {
    try {
      const { symbol, expiryDate, strikePrice, optionType, ltp, lotSize } = req.body;

      // Validate required fields
      if (!symbol || !expiryDate || !strikePrice || !optionType || !ltp || !lotSize) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "All fields are required: symbol, expiryDate, strikePrice, optionType, ltp, lotSize"
        });
      }

      // Create option with proper data formatting
      const option = await prisma.option.create({
        data: {
          symbol: symbol.toString() || "jjj", // Ensure symbol is stored as string
          expiry_date: expiryDate,
          strike_price: strikePrice,
          option_type: optionType,
          ltp:ltp,
          lot_size: parseInt(lotSize),
          updated_at: new Date()
        }
      });

      // Return formatted response
      res.status(201).json({
        success: true,
        option: {
          id: option.id,
          symbol: option.symbol,
          expiryDate: option.expiry_date,
          strikePrice: parseFloat(option.strike_price),
          optionType: option.option_type,
          ltp: parseFloat(option.ltp),
          lotSize: option.lot_size,
          updatedAt: option.updated_at
        }
      });

    } catch (error) {
      console.error("Option creation error:", error);
      res.status(400).json({
        error: "Failed to create option",
        details: error.message
      });
    }
  },

  // Get all options
  async getAllOptions(req, res) {
    try {
      const options = await prisma.option.findMany({
        include: { positions: true, trades: true },
      });
      res.status(200).json(options);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch options", details: error.message });
    }
  },

  // Get a single option by ID
  async getOptionById(req, res) {
    try {
      const { id } = req.params;
      const option = await prisma.option.findUnique({
        where: { id: parseInt(id) },
        include: { positions: true, trades: true },
      });
      if (!option) {
        return res.status(404).json({ error: "Option not found" });
      }
      res.status(200).json(option);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch option", details: error.message });
    }
  },

  // Update an option
  async updateOption(req, res) {
    try {
      const { id } = req.params;
      const { symbol, expiry_date, strike_price, option_type, ltp, lot_size } =
        req.body;
      const option = await prisma.option.update({
        where: { id: parseInt(id) },
        data: {
          symbol,
          expiry_date: expiry_date ? new Date(expiry_date) : undefined,
          strike_price: strike_price ? parseFloat(strike_price) : undefined,
          option_type,
          ltp: ltp ? parseFloat(ltp) : undefined,
          lot_size: lot_size ? parseInt(lot_size) : undefined,
        },
      });
      res.status(200).json(option);
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to update option", details: error.message });
    }
  },

  // Delete an option
  async deleteOption(req, res) {
    try {
      const { id } = req.params;
      await prisma.option.delete({
        where: { id: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to delete option", details: error.message });
    }
  },
};

// Position Controller
const positionController = {
  // Create a new position
  async createPosition(req, res) {
    try {
      const { optionId, netQuantity, averageEntryPrice, contestId } = req.body;
      const userId = parseInt(req.user.userId);

      // First find the contest participant
      const contestParticipant = await prisma.contestParticipant.findFirst({
        where: {
          user_id: userId,
          contest_id: parseInt(contestId),
          contest: {
            status: "ongoing"
          }
        }
      });

      if (!contestParticipant) {
        return res.status(404).json({ 
          error: "Contest participant not found", 
          details: "You are not participating in this contest or the contest is not active" 
        });
      }

      // Validate inputs
      if (!optionId || !netQuantity || !averageEntryPrice) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Parse values
      const parsedOptionId = parseInt(optionId);
      const parsedQuantity = parseInt(netQuantity);
      const parsedPrice = parseFloat(averageEntryPrice);

      // Validate parsed values
      if (isNaN(parsedOptionId) || isNaN(parsedQuantity) || isNaN(parsedPrice)) {
        return res.status(400).json({ error: "Invalid input values" });
      }

      // Create position with proper relations
      const position = await prisma.position.create({
        data: {
          net_quantity: parsedQuantity,
          average_entry_price: parsedPrice,
          contestParticipant: {
            connect: {
              id: contestParticipant.id
            }
          },
          option: {
            connect: {
              id: parsedOptionId
            }
          }
        },
        include: {
          contestParticipant: {
            include: {
              contest: true,
              user: true
            }
          },
          option: true
        }
      });

      // Return formatted response
      res.status(201).json({
        success: true,
        position: {
          id: position.id,
          quantity: position.net_quantity,
          averagePrice: parseFloat(position.average_entry_price),
          option: {
            id: position.option.id,
            symbol: position.option.symbol,
            strikePrice: parseFloat(position.option.strike_price),
            optionType: position.option.option_type
          },
          contest: {
            id: position.contestParticipant.contest.id,
            name: position.contestParticipant.contest.name
          }
        }
      });

    } catch (error) {
      console.error("Position creation error:", error);
      res.status(400).json({
        error: "Failed to create position",
        details: error.message
      });
    }
  },

  // Get all positions
  async getAllPositions(req, res) {
    try {
      const positions = await prisma.position.findMany({
        include: { contestParticipant: true, option: true },
      });
      res.status(200).json(positions);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch positions", details: error.message });
    }
  },

  // Get a single position by ID
  async getPositionById(req, res) {
    try {
      const { id } = req.params;
      const position = await prisma.position.findUnique({
        where: { id: parseInt(id) },
        include: { contestParticipant: true, option: true },
      });
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }
      res.status(200).json(position);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch position", details: error.message });
    }
  },

  // Update a position
  async updatePosition(req, res) {
    try {
      const { id } = req.params;
      const { net_quantity, average_entry_price } = req.body;
      const position = await prisma.position.update({
        where: { id: parseInt(id) },
        data: {
          net_quantity: net_quantity ? parseInt(net_quantity) : undefined,
          average_entry_price: average_entry_price
            ? parseFloat(average_entry_price)
            : undefined,
        },
      });
      res.status(200).json(position);
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to update position", details: error.message });
    }
  },

  // Delete a position
  async deletePosition(req, res) {
    try {
      const { id } = req.params;
      await prisma.position.delete({
        where: { id: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to delete position", details: error.message });
    }
  },
};

// Trade Controller
const tradeController = {
  // Create a new trade
  async createTrade(req, res) {
    try {
      const { optionId, contestId, action, quantity, price } = req.body;
      const userId = parseInt(req.user.userId);

      // Validate required fields
      if (!optionId || !contestId || !action || !quantity || !price) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "All fields are required: optionId, contestId, action, quantity, price"
        });
      }

      // Parse inputs safely
      const parsedOptionId = parseInt(optionId);
      const parsedContestId = parseInt(contestId);
      const parsedQuantity = parseInt(quantity);
      const parsedPrice = parseFloat(price);

      // Validate parsed values
      if (isNaN(parsedOptionId) || isNaN(parsedContestId) || 
          isNaN(parsedQuantity) || isNaN(parsedPrice)) {
        return res.status(400).json({
          error: "Invalid input values",
          details: "All numeric fields must be valid numbers"
        });
      }

      // Find specific contest participation
      const contestParticipant = await prisma.contestParticipant.findFirst({
        where: {
          user_id: userId,
          contest_id: parsedContestId,
          contest: {
            status: "ongoing",
          },
        },
        include: {
          contest: true,
          trades: {
            where: {
              contestParticipant: {
                contest_id: parsedContestId,
              },
            },
          },
        },
      });

      // Validate contest participation
      if (!contestParticipant) {
        return res.status(400).json({
          error: "You are not participating in this contest",
        });
      }

      // Check if contest is active
      if (contestParticipant.contest.status !== "ongoing") {
        return res.status(400).json({
          error: "Contest is not active",
        });
      }

      // Check trade limits
      const contestTrades = contestParticipant.trades;
      if (contestTrades.length >= parseInt(contestParticipant.contest.maxTrade)) {
        return res.status(400).json({
          error: `Maximum trades limit (${contestParticipant.contest.maxTrade}) reached`,
          currentTrades: contestTrades.length,
          maxAllowed: contestParticipant.contest.maxTrade,
        });
      }

      // Calculate trade value
      const tradeValue = parsedPrice * parsedQuantity;

      // Check virtual cash for buy orders
      if (action === "buy") {
        const currentVirtualCash = parseFloat(contestParticipant.virtual_cash);
        if (tradeValue > currentVirtualCash) {
          return res.status(400).json({
            error: "Insufficient virtual cash",
            available: currentVirtualCash,
            required: tradeValue,
            deficit: tradeValue - currentVirtualCash,
          });
        }
      }

      // Create the trade with validated data
      const trade = await prisma.trade.create({
        data: {
          contestParticipant: {
            connect: {
              id: contestParticipant.id
            }
          },
          option: {
            connect: {
              id: parsedOptionId // Now properly parsed
            }
          },
          action: action,
          quantity: parsedQuantity,
          price: parsedPrice
        },
        include: {
          contestParticipant: true,
          option: true
        }
      });

      // Update virtual cash
      const cashUpdate = action === "buy" ? -tradeValue : tradeValue;
      await prisma.contestParticipant.update({
        where: {
          id: contestParticipant.id
        },
        data: {
          virtual_cash: {
            increment: cashUpdate
          }
        }
      });

      // Return success response
      res.status(201).json({
        success: true,
        trade: trade,
        contestStatus: {
          contestId: parsedContestId,
          tradesUsed: contestTrades.length + 1,
          tradesRemaining: parseInt(contestParticipant.contest.maxTrade) - (contestTrades.length + 1),
          virtualCashBefore: parseFloat(contestParticipant.virtual_cash),
          virtualCashAfter: parseFloat(contestParticipant.virtual_cash) + cashUpdate,
          tradeValue: tradeValue
        }
      });

    } catch (error) {
      console.error("Trade creation error:", error);
      res.status(400).json({
        error: "Failed to create trade",
        details: error.message
      });
    }
  },

  // Get all trades
  async getAllTrades(req, res) {
    try {
      const trades = await prisma.trade.findMany({
        include: { contestParticipant: true, option: true },
      });
      res.status(200).json(trades);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch trades", details: error.message });
    }
  },

  // Get a single trade by ID
  async getTradeById(req, res) {
    try {
      const { id } = req.params;
      const trade = await prisma.trade.findUnique({
        where: { id: parseInt(id) },
        include: { contestParticipant: true, option: true },
      });
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      res.status(200).json(trade);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch trade", details: error.message });
    }
  },

  // Update a trade
  async updateTrade(req, res) {
    try {
      const { id } = req.params;
      const { action, quantity, price } = req.body;
      const trade = await prisma.trade.update({
        where: { id: parseInt(id) },
        data: {
          action,
          quantity: quantity ? parseInt(quantity) : undefined,
          price: price ? parseFloat(price) : undefined,
        },
      });
      res.status(200).json(trade);
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to update trade", details: error.message });
    }
  },

  // Delete a trade
  async deleteTrade(req, res) {
    try {
      const { id } = req.params;
      await prisma.trade.delete({
        where: { id: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to delete trade", details: error.message });
    }
  },
};

// WalletTransaction Controller
const walletTransactionController = {
  // Create a new wallet transaction
  async createWalletTransaction(req, res) {
    try {
      const { amount, type, status } = req.body;

      // Validate input
      if (!amount || !type || !status) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const parsedUserId = parseInt(req.user.userId);
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedUserId) || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid user_id or amount" });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: parsedUserId },
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Handle null amount
      const currentBalance = user.amount !== null ? parseFloat(user.amount) : 0;

      // Check balance for DEBIT
      if (type === "DEBIT" && currentBalance < parsedAmount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Update user's amount
      const updatedUser = await prisma.user.update({
        where: { id: parsedUserId },
        data: {
          amount:
            type === "DEPOSIT" || type == "deposit"
              ? currentBalance + parsedAmount
              : currentBalance - parsedAmount,
        },
      });

      // Create wallet transaction
      const transaction = await prisma.walletTransaction.create({
        data: {
          user_id: parsedUserId,
          amount: parsedAmount,
          type,
          status,
          created_at: new Date(),
        },
      });

      res.status(201).json({
        message: "Transaction created successfully",
        transaction,
        updatedBalance: updatedUser.amount,
      });
    } catch (error) {
      console.error("Error creating transaction:", error);
      res
        .status(400)
        .json({
          error: "Failed to create transaction",
          details: error.message,
        });
    }
  },

  // Get all wallet transactions
  async getAllWalletTransactions(req, res) {
    try {
      const userId = parseInt(req.user.userId);

      const transactions = await prisma.walletTransaction.findMany({
        where: {
          user_id: userId,
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      });

      // Format the response
      const formattedTransactions = transactions.map((transaction) => ({
        id: transaction.id,
        amount: parseFloat(transaction.amount),
        type: transaction.type,
        status: transaction.status,
        created_at: transaction.created_at,
        user: {
          name: `${transaction.user.firstName} ${transaction.user.lastName}`,
          email: transaction.user.email,
        },
      }));

      res.status(200).json({
        success: true,
        count: transactions.length,
        transactions: formattedTransactions,
      });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch transactions",
        details: error.message,
      });
    }
  },

  // Get a single wallet transaction by ID
  async getWalletTransactionById(req, res) {
    try {
      const { id } = req.params;
      const transaction = await prisma.walletTransaction.findUnique({
        where: { id: parseInt(id) },
        include: { user: true },
      });
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.status(200).json(transaction);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch transaction", details: error.message });
    }
  },

  // Update a wallet transaction
  async updateWalletTransaction(req, res) {
    try {
      const { id } = req.params;
      const { amount, type, status } = req.body;
      const transaction = await prisma.walletTransaction.update({
        where: { id: parseInt(id) },
        data: {
          amount: amount ? parseFloat(amount) : undefined,
          type,
          status,
        },
      });
      res.status(200).json(transaction);
    } catch (error) {
      res
        .status(400)
        .json({
          error: "Failed to update transaction",
          details: error.message,
        });
    }
  },

  // Delete a wallet transaction
  async deleteWalletTransaction(req, res) {
    try {
      const { id } = req.params;
      await prisma.walletTransaction.delete({
        where: { id: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res
        .status(400)
        .json({
          error: "Failed to delete transaction",
          details: error.message,
        });
    }
  },
};

// ContestWinner Controller
const contestWinnerController = {
  // Create a new contest winner
  async createContestWinner(req, res) {
    try {
      const { contest_id, user_id, rank, prize } = req.body;
      const winner = await prisma.contestWinner.create({
        data: {
          contest_id: parseInt(contest_id),
          user_id: parseInt(user_id),
          rank: parseInt(rank),
          prize: parseFloat(prize),
        },
      });
      res.status(201).json(winner);
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to create winner", details: error.message });
    }
  },

  // Get all contest winners
  async getAllContestWinners(req, res) {
    try {
      const winners = await prisma.contestWinner.findMany({
        include: { contest: true, user: true },
      });
      res.status(200).json(winners);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch winners", details: error.message });
    }
  },

  // Get a single contest winner by ID
  async getContestWinnerById(req, res) {
    try {
      const { id } = req.params;
      const winner = await prisma.contestWinner.findUnique({
        where: { id: parseInt(id) },
        include: { contest: true, user: true },
      });
      if (!winner) {
        return res.status(404).json({ error: "Winner not found" });
      }
      res.status(200).json(winner);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch winner", details: error.message });
    }
  },

  // Update a contest winner
  async updateContestWinner(req, res) {
    try {
      const { id } = req.params;
      const { rank, prize } = req.body;
      const winner = await prisma.contestWinner.update({
        where: { id: parseInt(id) },
        data: {
          rank: rank ? parseInt(rank) : undefined,
          prize: prize ? parseFloat(prize) : undefined,
        },
      });
      res.status(200).json(winner);
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to update winner", details: error.message });
    }
  },

  // Delete a contest winner
  async deleteContestWinner(req, res) {
    try {
      const { id } = req.params;
      await prisma.contestWinner.delete({
        where: { id: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to delete winner", details: error.message });
    }
  },
};

// Referral Controller
const referralController = {
  // Create a new referral
  async createReferral(req, res) {
    try {
      const { referrer_id, referred_id, reward_amount } = req.body;
      const referral = await prisma.referral.create({
        data: {
          referrer_id: parseInt(referrer_id),
          referred_id: parseInt(referred_id),
          reward_amount: parseFloat(reward_amount) || 0.0,
        },
      });
      res.status(201).json(referral);
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to create referral", details: error.message });
    }
  },

  // Get all referrals
  async getAllReferrals(req, res) {
    try {
      const referrals = await prisma.referral.findMany({
        include: { referrer: true, referred: true },
      });
      res.status(200).json(referrals);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch referrals", details: error.message });
    }
  },

  // Get a single referral by ID
  async getReferralById(req, res) {
    try {
      const { id } = req.params;
      const referral = await prisma.referral.findUnique({
        where: { id: parseInt(id) },
        include: { referrer: true, referred: true },
      });
      if (!referral) {
        return res.status(404).json({ error: "Referral not found" });
      }
      res.status(200).json(referral);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch referral", details: error.message });
    }
  },

  // Update a referral
  async updateReferral(req, res) {
    try {
      const { id } = req.params;
      const { reward_amount } = req.body;
      const referral = await prisma.referral.update({
        where: { id: parseInt(id) },
        data: {
          reward_amount: reward_amount ? parseFloat(reward_amount) : undefined,
        },
      });
      res.status(200).json(referral);
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to update referral", details: error.message });
    }
  },

  // Delete a referral
  async deleteReferral(req, res) {
    try {
      const { id } = req.params;
      await prisma.referral.delete({
        where: { id: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res
        .status(400)
        .json({ error: "Failed to delete referral", details: error.message });
    }
  },
};

module.exports = {
  contestController,
  contestParticipantController,
  optionController,
  positionController,
  tradeController,
  walletTransactionController,
  contestWinnerController,
  referralController,
};
