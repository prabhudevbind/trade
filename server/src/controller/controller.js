const prisma = require("../utils/prisma");

// Contest Controller
const contestController = {
  // Create a new contest
 async createContest(req, res) {
  try {
    const {
      name,
      startTime,
      endTime,
      entryFee,
      maxTrade,
      status,
      trading_instrument,
    } = req.body;

    // Validation
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'Name, startTime, and endTime are required' 
      });
    }

    // Date validation
    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    if (start >= end) {
      return res.status(400).json({ 
        error: 'Invalid date range', 
        details: 'Start time must be before end time' 
      });
    }

    if (status === 'ongoing' && end <= now) {
      return res.status(400).json({ 
        error: 'Invalid ongoing contest', 
        details: 'Cannot create ongoing contest that has already ended' 
      });
    }

    // Check for existing ongoing contest if status is 'ongoing'
    if (status === 'ongoing') {
      const ongoing = await prisma.contest.findFirst({ 
        where: { status: 'ongoing' },
        select: { id: true, name: true, end_time: true }
      });
      
      if (ongoing) {
        return res.status(400).json({ 
          error: 'Only one ongoing contest is allowed at a time.',
          details: `Contest "${ongoing.name}" is currently ongoing until ${ongoing.end_time}`,
          existingContest: {
            id: ongoing.id,
            name: ongoing.name,
            endTime: ongoing.end_time
          }
        });
      }
    }

    // Check for overlapping contests (optional - for better contest management)
    const overlappingContest = await prisma.contest.findFirst({
      where: {
        AND: [
          {
            OR: [
              { status: 'ongoing' },
              { status: 'upcoming' }
            ]
          },
          {
            OR: [
              // New contest starts before existing ends and after existing starts
              {
                AND: [
                  { start_time: { lte: start } },
                  { end_time: { gt: start } }
                ]
              },
              // New contest ends after existing starts and before existing ends
              {
                AND: [
                  { start_time: { lt: end } },
                  { end_time: { gte: end } }
                ]
              },
              // New contest completely encompasses existing contest
              {
                AND: [
                  { start_time: { gte: start } },
                  { end_time: { lte: end } }
                ]
              }
            ]
          }
        ]
      },
      select: { id: true, name: true, start_time: true, end_time: true, status: true }
    });

    if (overlappingContest) {
      return res.status(400).json({
        error: 'Contest time overlap detected',
        details: `This contest overlaps with "${overlappingContest.name}" (${overlappingContest.status})`,
        overlappingContest: {
          id: overlappingContest.id,
          name: overlappingContest.name,
          startTime: overlappingContest.start_time,
          endTime: overlappingContest.end_time,
          status: overlappingContest.status
        }
      });
    }

    // Auto-determine status based on dates if not provided
    let contestStatus = status;
    if (!contestStatus) {
      if (start <= now && end > now) {
        // Check if we can make it ongoing (no other ongoing contests)
        const existingOngoing = await prisma.contest.findFirst({ 
          where: { status: 'ongoing' } 
        });
        
        if (existingOngoing) {
          contestStatus = 'upcoming'; // Can't be ongoing, so make it upcoming
        } else {
          contestStatus = 'ongoing';
        }
      } else if (start > now) {
        contestStatus = 'upcoming';
      } else {
        contestStatus = 'completed';
      }
    }

    // Create the contest
    const contest = await prisma.contest.create({
      data: {
        name,
        start_time: start,
        end_time: end,
        maxTrade: maxTrade || 10, // Default max trades
        entry_fee: parseFloat(entryFee) || 0,
        status: contestStatus,
        trading_instrument: trading_instrument || "BOTH",
      },
    });

    // Log the creation for audit purposes
    console.log(`Contest created: ${contest.name} (ID: ${contest.id}) - Status: ${contest.status}`);

    res.status(201).json({
      success: true,
      message: 'Contest created successfully',
      contest,
      autoStatus: !status ? `Status auto-determined as '${contestStatus}'` : null
    });

  } catch (error) {
    console.error('Error creating contest:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: 'Contest with this name already exists',
        details: 'Please choose a different contest name'
      });
    }

    res.status(400).json({ 
      error: "Failed to create contest", 
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
},

  // Get all contests
  async getAllContests(req, res) {
    try {
      // const userId = parseInt(req.user.userId);

      // Get all contests with participant info for the current user
      const contests = await prisma.contest.findMany({
        include: {
          contestParticipants: true,

          _count: {
            select: {
              contestParticipants: true,
            },
          },
        },
      });

      // Format response
      // const formattedContests = contests.map((contest) => ({
      //   id: contest.id,
      //   name: contest.name,
      //   startTime: contest.start_time,
      //   endTime: contest.end_time,
      //   entryFee: parseFloat(contest.entry_fee),
      //   maxTrade: contest.maxTrade,
      //   status: contest.status,
      //   tradingInstrument: contest.trading_instrument,
      //   totalParticipants: contest._count.contestParticipants,
      //   hasJoined: contest.contestParticipants.length > 0,
      //   userParticipation: contest.contestParticipants[0] || null,
      //   userWinning: contest.contestWinners[0] || null,
      // }));

      res.status(200).json({
        success: true,
        count: contests.length,
        contests: contests,
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
          id: parseInt(id),
        },
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
              positions: {
                include: {
                  option: true,
                },
              },
              trades: {
                include: {
                  option: true,
                },
                orderBy: {
                  timestamp: "desc",
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
        participation: contest.contestParticipants[0]
          ? {
              id: contest.contestParticipants[0].id,
              virtualCash: parseFloat(
                contest.contestParticipants[0].virtual_cash
              ),
              trades_taken: contest.contestParticipants[0].trades.length,
              positions: contest.contestParticipants[0].positions.map(
                (pos) => ({
                  id: pos.id,
                  symbol: pos.option.symbol,
                  strikePrice: parseFloat(pos.option.strike_price),
                  optionType: pos.option.option_type,
                  quantity: pos.net_quantity,
                  averagePrice: parseFloat(pos.average_entry_price),
                  currentPrice: parseFloat(pos.option.ltp),
                  pnl:
                    (parseFloat(pos.option.ltp) -
                      parseFloat(pos.average_entry_price)) *
                    pos.net_quantity,
                })
              ),
              recentTrades: contest.contestParticipants[0].trades
                .slice(0, 5)
                .map((trade) => ({
                  id: trade.id,
                  timestamp: trade.timestamp,
                  action: trade.action,
                  symbol: trade.option.symbol,
                  strikePrice: parseFloat(trade.option.strike_price),
                  quantity: trade.quantity,
                  price: parseFloat(trade.price),
                })),
            }
          : null,
        winning: contest.contestWinners[0] || null,
      };

      res.status(200).json({
        success: true,
        contest: formattedContest,
      });
    } catch (error) {
      console.error("Error fetching contest:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch contest",
        details: error.message,
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

      // Check for existing ongoing contest if updating to 'ongoing'
      if (status === 'ongoing') {
        const ongoing = await prisma.contest.findFirst({
          where: {
            status: 'ongoing',
            NOT: { id: parseInt(id) },
          },
        });
        if (ongoing) {
          return res.status(400).json({ error: 'Only one ongoing contest is allowed at a time.' });
        }
      }

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
      const { contest_id, virtual_cash } = req.body;
      const user_id = req.user.userId;

      // Check if the new contest exists and is still active
      const newContest = await prisma.contest.findUnique({
        where: {
          id: parseInt(contest_id),
        },
      });

      if (!newContest) {
        return res.status(404).json({
          error: "Contest not found",
        });
      }

      if (newContest.end_date < new Date()) {
        return res.status(400).json({
          error: "Contest has already ended",
        });
      }

      // Check if user is already participating in any active contest
      const existingParticipation = await prisma.contestParticipant.findFirst({
        where: {
          user_id: parseInt(user_id),
          contest: {
            end_time: {
              gt: new Date(), // Check if contest end date is greater than current date
            },
          },
        },
        include: {
          contest: true,
        },
      });

      // If user is already in an active contest, remove them first
      if (existingParticipation) {
        await prisma.contestParticipant.delete({
          where: {
            id: existingParticipation.id,
          },
        });
      }

      // Create new participant
      const participant = await prisma.contestParticipant.create({
        data: {
          user_id: parseInt(user_id),
          contest_id: parseInt(contest_id),
          virtual_cash: parseFloat(virtual_cash) || 100000.0,
        },
      });

      const response = {
        participant,
        message: existingParticipation 
          ? `Removed from "${existingParticipation.contest.name}" and joined "${newContest.name}"`
          : `Successfully joined "${newContest.name}"`
      };

      res.status(201).json(response);
    } catch (error) {
      res.status(400).json({
        error: "Failed to create participant",
        details: error.message,
      });
    }
  },
  // Get active contest for a specific user
async getActiveContestForUser(req, res) {
  try {
    const user_id = req.user.userId; // From authenticated user
    // Or if you want to get from params: const { user_id } = req.params;

    // Find the user's active contest participation
    const activeParticipation = await prisma.contestParticipant.findFirst({
      where: {
        user_id: parseInt(user_id),
        contest: {
          end_time: {
            gt: new Date(), // Contest end date is greater than current date
          },
        },
      },
      include: {
        contest: true,
      },
    });

    if (!activeParticipation) {
      return res.status(404).json({
        message: "No active contest found for this user",
      });
    }


    res.status(200).json(activeParticipation);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch active contest",
      details: error.message,
    });
  }
},

  // Get all contest participants
async getAllContestParticipants(req, res) {
  try {
    const userId = parseInt(req.user.userId);
    const userRole = req.user.role;

    // Build the where clause based on user role
    const whereClause = userRole === "admin" ? {} : { user_id: userId };

    const participants = await prisma.contestParticipant.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        contest: {
          select: {
            name: true,
            start_time: true,
            end_time: true,
            entry_fee: true,
            maxTrade: true,
            status: true,
            trading_instrument: true,
          },
        },
        positions: {
          include: {
            option: true,
          },
        },
        trades: {
          include: {
            option: true,
          },
          orderBy: {
            timestamp: "desc",
          },
        },
      },
     
    });

    // Format the response
    const formattedParticipants = participants.map((participant) => ({
      id: participant.id,
      contestInfo: {
        id: participant.contest_id,
        name: participant.contest.name,
        status: participant.contest.status,
        startTime: participant.contest.start_time,
        endTime: participant.contest.end_time,
        tradingInstrument: participant.contest.trading_instrument,
        maxTrades: parseInt(participant.contest.maxTrade),
        entryFee: parseFloat(participant.contest.entry_fee),
      },
      userInfo: {
        name: `${participant.user.firstName} ${participant.user.lastName}`,
        email: participant.user.email,
      },
      tradingInfo: {
        virtualCash: parseFloat(participant.virtual_cash),
        tradesUsed: participant.trades.length,
        tradesRemaining:
          parseInt(participant.contest.maxTrade) - participant.trades.length,
        positions: participant.positions.map((pos) => ({
          id: pos.id,
          symbol: pos.option.symbol,
          strikePrice: parseFloat(pos.option.strike_price),
          optionType: pos.option.option_type,
          quantity: pos.net_quantity,
          averagePrice: parseFloat(pos.average_entry_price),
          currentPrice: parseFloat(pos.option.ltp),
          pnl:
            (parseFloat(pos.option.ltp) -
              parseFloat(pos.average_entry_price)) *
            pos.net_quantity,
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
      },
      created_at: participant.created_at,
      updated_at: participant.updated_at,
    }));

    res.status(200).json({
      success: true,
      count: participants.length,
      participants: formattedParticipants,
      // Optional: Include metadata about the request scope
      scope: userRole === "admin" ? "all_participants" : "user_participants",
    });
  } catch (error) {
    console.error("Error fetching participants:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch participants",
      details: error.message,
    });
  }
},

  // Get a single contest participant by ID
  async getContestParticipantById(req, res) {
    try {
      const id = req.user.userId;
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
      res.status(400).json({
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
      res.status(400).json({
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

  // Get user's active contest trades
  async getUserActiveTrades(req, res) {
    try {
      const userId = req.user.userId;
      console.log(userId);
      // First find the active contest participation for this user
      const activeParticipation = await prisma.contestParticipant.findFirst({
        where: {
          user_id: userId,
          contest: {
            status: 'ongoing',
          },
        },
        include: {
          contest: true,
        },
      });


      if (!activeParticipation) {
        return res.status(404).json({
          error: "No active contest found for this user",
        });
      }
      console.log(activeParticipation);

      // Get all trades for this participation
      const trades = await prisma.trade.findMany({
        where: {
          contest_participant_id: activeParticipation.user_id,
        },
        include: {
          option: {
            select: {
              symbol: true,
              strike_price: true,
              option_type: true,
              expiry_date: true,
              ltp: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
      console.log(trades);

      // Get positions for this participation
      const positions = await prisma.position.findMany({
        where: {
          contest_participant_id: activeParticipation.id,
        },
        include: {
          option: {
            select: {
              symbol: true,
              strike_price: true,
              option_type: true,
              expiry_date: true,
              ltp: true,
            },
          },
        },
      });

      // Calculate PnL for positions
      const positionsWithPnL = positions.map(position => {
        const currentValue = parseFloat(position.option.ltp) * position.net_quantity;
        const costBasis = parseFloat(position.average_entry_price) * position.net_quantity;
        const unrealizedPnL = currentValue - costBasis;

        return {
          ...position,
          unrealizedPnL,
          currentValue,
        };
      });

      return res.json({
        contest: activeParticipation.contest,
        virtualCash: activeParticipation.virtual_cash,
        trades: trades.map(trade => ({
          id: trade.id,
          symbol: trade.option.symbol,
          strikePrice: trade.option.strike_price,
          optionType: trade.option.option_type,
          expiryDate: trade.option.expiry_date,
          action: trade.action,
          quantity: trade.quantity,
          price: trade.price,
          timestamp: trade.timestamp,
          value: parseFloat(trade.price) * trade.quantity,
        })),
        positions: positionsWithPnL,
      });

    } catch (error) {
      console.error('Error fetching user trades:', error);
      return res.status(500).json({
        error: "Failed to fetch trades",
        details: error.message,
      });
    }
  },

  // Get user trading statistics and leaderboard
  async getUserTradingStats(req, res) {
    try {

      let userId=req.user.userId;

      const activeContests=await prisma.context.findFirst(
        userId,
        ongoint
      )
      const contestId = parseInt(activeContests.id); // Optional: filter by specific contest

      // Get all contest participants with their positions and trades
      const participantsQuery = {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              img: true,
            }
          },
          contest: true,
          positions: {
            include: {
              option: {
                select: {
                  symbol: true,
                  strike_price: true,
                  option_type: true,
                  expiry_date: true,
                  ltp: true,
                }
              }
            }
          },
          trades: {
            include: {
              option: {
                select: {
                  symbol: true,
                  strike_price: true,
                  option_type: true,
                  expiry_date: true,
                  ltp: true,
                }
              }
            }
          }
        }
      };

      // Add contest filter if provided
      if (contestId) {
        participantsQuery.where = {
          contest_id: contestId
        };
      }

      const participants = await prisma.contestParticipant.findMany(participantsQuery);

      // Calculate statistics for each participant
      const userStats = participants.map(participant => {
        // Calculate total P&L from positions
        const positionsPnL = participant.positions.reduce((total, position) => {
          const currentValue = parseFloat(position.option.ltp) * position.net_quantity;
          const costBasis = parseFloat(position.average_entry_price) * position.net_quantity;
          return total + (currentValue - costBasis);
        }, 0);

        // Calculate trading statistics
        const trades = participant.trades;
        const totalTrades = trades.length;
        const buyTrades = trades.filter(t => t.action === 'buy').length;
        const sellTrades = trades.filter(t => t.action === 'sell').length;

        // Calculate win rate (assuming a trade is winning if price moved in favorable direction)
        const winningTrades = trades.filter(trade => {
          const currentPrice = parseFloat(trade.option.ltp);
          const tradePrice = parseFloat(trade.price);
          return (trade.action === 'buy' && currentPrice > tradePrice) ||
                 (trade.action === 'sell' && currentPrice < tradePrice);
        }).length;

        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        // Calculate ROI
        const initialCash = 100000; // Default initial cash
        const currentValue = parseFloat(participant.virtual_cash) + positionsPnL;
        const roi = ((currentValue - initialCash) / initialCash) * 100;

        return {
          userId: participant.user_id,
          userName: participant.user.name,
          userImage: participant.user.img,
          contestId: participant.contest_id,
          contestName: participant.contest.name,
          virtualCash: parseFloat(participant.virtual_cash),
          totalPnL: positionsPnL,
          totalValue: currentValue,
          roi: roi,
          tradingStats: {
            totalTrades,
            buyTrades,
            sellTrades,
            winningTrades,
            winRate,
          },
          positions: participant.positions.map(pos => ({
            symbol: pos.option.symbol,
            strikePrice: pos.option.strike_price,
            optionType: pos.option.option_type,
            quantity: pos.net_quantity,
            averagePrice: parseFloat(pos.average_entry_price),
            currentPrice: parseFloat(pos.option.ltp),
            pnl: (parseFloat(pos.option.ltp) - parseFloat(pos.average_entry_price)) * pos.net_quantity,
          })),
          trades: participant.trades.map(trade => ({
            symbol: trade.option.symbol,
            strikePrice: trade.option.strike_price,
            optionType: trade.option.option_type,
            action: trade.action,
            quantity: trade.quantity,
            price: parseFloat(trade.price),
            timestamp: trade.timestamp,
            currentPrice: parseFloat(trade.option.ltp),
          }))
        };
      });

      // Sort users by ROI for leaderboard ranking
      const leaderboard = [...userStats].sort((a, b) => b.roi - a.roi)
        .map((user, index) => ({
          ...user,
          rank: index + 1
        }));

      return res.json({
        leaderboard,
        stats: {
          totalParticipants: participants.length,
          averageROI: leaderboard.reduce((sum, user) => sum + user.roi, 0) / participants.length,
          topROI: leaderboard[0]?.roi || 0,
          totalTradingVolume: participants.reduce((sum, p) => 
            sum + p.trades.reduce((tSum, t) => tSum + (parseFloat(t.price) * t.quantity), 0), 0
          ),
        }
      });

    } catch (error) {
      console.error('Error fetching trading stats:', error);
      return res.status(500).json({
        error: "Failed to fetch trading statistics",
        details: error.message,
      });
    }
  },

  // Get leaderboard for user's active contest
async getActiveContestLeaderboard(req, res) {
  try {
    // Check if user ID exists
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        error: "Unauthorized",
        details: "User not authenticated"
      });
    }

    const userId = req.user.userId;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin';

    // Verify Prisma connection
    if (!prisma) {
      throw new Error("Database connection not established");
    }

    console.log('User requesting leaderboard:', req.user);

    // For admin, find any active contest; for users, find their participation
    let activeContestId = null;
    let activeParticipation = null;

    if (isAdmin) {
      // Admin can view any active contest - get the first active contest
      const activeContest = await prisma.contest.findFirst({
        where: {
          status: 'ongoing',
        },
      });

      if (!activeContest) {
        return res.status(404).json({
          error: "No active contest found",
          isParticipating: false,
        });
      }

      activeContestId = activeContest.id;
      
      // Check if admin is also participating
      activeParticipation = await prisma.contestParticipant.findFirst({
        where: {
          user_id: userId,
          contest_id: activeContestId,
        },
        include: {
          contest: true,
        },
      });

      // If admin is not participating, create a mock participation object
      if (!activeParticipation) {
        activeParticipation = {
          contest_id: activeContestId,
          contest: activeContest,
        };
      }
    } else {
      // Regular user - find their active participation
      activeParticipation = await prisma.contestParticipant.findFirst({
        where: {
          user_id: userId,
          contest: {
            status: 'ongoing',
          },
        },
        include: {
          contest: true,
        },
      });

      if (!activeParticipation) {
        return res.status(404).json({
          error: "You are not participating in any active contest",
          isParticipating: false,
        });
      }

      activeContestId = activeParticipation.contest_id;
    }

    console.log('Active participation:', activeParticipation);

    // Get all participants in the contest
    const contestParticipants = await prisma.contestParticipant.findMany({
      where: {
        contest_id: activeContestId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            img: true,
            email: true, // Include email for admin view
          }
        },
        positions: {
          include: {
            option: {
              select: {
                symbol: true,
                strike_price: true,
                option_type: true,
                expiry_date: true,
                ltp: true,
              }
            }
          }
        },
        trades: {
          include: {
            option: {
              select: {
                symbol: true,
                strike_price: true,
                option_type: true,
                expiry_date: true,
                ltp: true,
              }
            }
          },
          orderBy: {
            timestamp: 'desc'
          }
        }
      }
    });

    if (contestParticipants.length === 0) {
      return res.status(404).json({
        error: "No participants found in the active contest",
        isParticipating: false,
      });
    }

    // Get current date for expiry comparison
    const currentDate = new Date();
    
    // Calculate statistics for each participant
    const participantStats = contestParticipants.map(participant => {
      // Filter active positions (non-expired and non-zero quantity)
      const activePositions = participant.positions.filter(position => {
        const expiryDate = new Date(position.option.expiry_date);
        return position.net_quantity !== 0 && expiryDate > currentDate;
      });

      // Calculate positions P&L only for active (non-expired) positions
      const positionsPnL = activePositions.reduce((total, position) => {
        if (!position.option.ltp || position.net_quantity === 0) return total;
        
        const currentValue = parseFloat(position.option.ltp) * position.net_quantity;
        const costBasis = parseFloat(position.average_entry_price) * position.net_quantity;
        return total + (currentValue - costBasis);
      }, 0);

      // Calculate realized P&L from trades
      const realizedPnL = participant.trades.reduce((total, trade) => {
        const tradeValue = parseFloat(trade.price) * Math.abs(trade.quantity);
        return trade.action === 'sell' ? total + tradeValue : total - tradeValue;
      }, 0);

      // Calculate current portfolio value
      const virtualCash = parseFloat(participant.virtual_cash) || 0;
      const portfolioValue = virtualCash + positionsPnL;
      const initialCash = 100000; // Assuming initial cash was 100000
      const totalPnL = portfolioValue - initialCash;

      const userStats = {
        userId: participant.user.id,
        userName: participant.user.username,
        userImage: participant.user.img,
        isCurrentUser: participant.user.id === userId,
        virtualCash: virtualCash,
        unrealizedPnL: positionsPnL,
        realizedPnL: realizedPnL,
        totalPnL: totalPnL,
        portfolioValue: portfolioValue,
        roi: ((portfolioValue - initialCash) / initialCash) * 100,
        tradingStats: {
          totalTrades: participant.trades.length,
          buyTrades: participant.trades.filter(t => t.action === 'buy').length,
          sellTrades: participant.trades.filter(t => t.action === 'sell').length,
          profitableTrades: participant.trades.filter(t => 
            t.action === 'sell' && parseFloat(t.price) > 0
          ).length,
        },
        activePositions: activePositions.map(pos => ({
          symbol: pos.option.symbol,
          strikePrice: pos.option.strike_price,
          optionType: pos.option.option_type,
          expiryDate: pos.option.expiry_date,
          quantity: pos.net_quantity,
          averagePrice: parseFloat(pos.average_entry_price),
          currentPrice: parseFloat(pos.option.ltp),
          pnl: (parseFloat(pos.option.ltp) - parseFloat(pos.average_entry_price)) * pos.net_quantity,
          isExpired: false, // All positions here are active/non-expired
        })),
        expiredPositions: participant.positions
          .filter(pos => {
            const expiryDate = new Date(pos.option.expiry_date);
            return pos.net_quantity !== 0 && expiryDate <= currentDate;
          })
          .map(pos => ({
            symbol: pos.option.symbol,
            strikePrice: pos.option.strike_price,
            optionType: pos.option.option_type,
            expiryDate: pos.option.expiry_date,
            quantity: pos.net_quantity,
            averagePrice: parseFloat(pos.average_entry_price),
            isExpired: true,
            expiredOn: pos.option.expiry_date,
          })),
      };

      // Add admin-only fields
      if (isAdmin) {
        userStats.userEmail = participant.user.email;
        userStats.joinedAt = participant.joined_at;
        userStats.lastTradeTime = participant.trades.length > 0 ? participant.trades[0].timestamp : null;
      }

      return userStats;
    });

    // Sort by portfolio value for ranking
    const leaderboard = participantStats
      .sort((a, b) => b.portfolioValue - a.portfolioValue)
      .map((participant, index) => ({
        ...participant,
        rank: index + 1
      }));

    // Get user's ranking (if user is participating)
    const userRank = leaderboard.find(p => p.userId === userId)?.rank || null;

    // Calculate contest statistics
    const contestStats = {
      averageROI: leaderboard.length > 0 ? 
        leaderboard.reduce((sum, p) => sum + p.roi, 0) / leaderboard.length : 0,
      highestPnL: leaderboard.length > 0 ? 
        Math.max(...leaderboard.map(p => p.totalPnL)) : 0,
      lowestPnL: leaderboard.length > 0 ? 
        Math.min(...leaderboard.map(p => p.totalPnL)) : 0,
      totalTradingVolume: participantStats.reduce((sum, p) => 
        sum + p.tradingStats.totalTrades, 0
      ),
      activeTraders: participantStats.filter(p => p.tradingStats.totalTrades > 0).length,
      profitableTraders: participantStats.filter(p => p.totalPnL > 0).length,
    };

    // Prepare contest info
    const contestInfo = {
      id: activeParticipation.contest_id,
      name: activeParticipation.contest.name,
      startTime: activeParticipation.contest.start_time,
      endTime: activeParticipation.contest.end_time,
      maxTrade: activeParticipation.contest.maxTrade,
      entryFee: activeParticipation.contest.entry_fee,
      status: activeParticipation.contest.status,
    };

    // Role-based response
    if (isAdmin) {
      // Admin: return full leaderboard with additional stats
      return res.json({
        success: true,
        isParticipating: userRank !== null,
        isAdmin: true,
        contestInfo,
        userRank,
        totalParticipants: contestParticipants.length,
        leaderboard, // Full leaderboard for admin
        contestStats,
        adminStats: {
          totalParticipants: contestParticipants.length,
          participantsWithPositions: participantStats.filter(p => p.activePositions.length > 0).length,
          participantsWithExpiredPositions: participantStats.filter(p => p.expiredPositions.length > 0).length,
          totalPortfolioValue: participantStats.reduce((sum, p) => sum + p.portfolioValue, 0),
          averagePortfolioValue: participantStats.length > 0 ? 
            participantStats.reduce((sum, p) => sum + p.portfolioValue, 0) / participantStats.length : 0,
          totalActivePositions: participantStats.reduce((sum, p) => sum + p.activePositions.length, 0),
          totalExpiredPositions: participantStats.reduce((sum, p) => sum + p.expiredPositions.length, 0),
        }
      });
    } else {
      // Non-admin: return only current user's data
      const userEntry = leaderboard.find(p => p.userId === userId);
      
      return res.json({
        success: true,
        isParticipating: true,
        isAdmin: false,
        contestInfo,
        userRank,
        totalParticipants: contestParticipants.length,
        leaderboard: userEntry ? [userEntry] : [], // Only user's entry
        contestStats: {
          averageROI: contestStats.averageROI,
          highestPnL: contestStats.highestPnL,
          totalTradingVolume: contestStats.totalTradingVolume,
        },
        userPosition: userEntry || null,
      });
    }

  } catch (error) {
    console.error('Error fetching contest leaderboard:', error);
    
    // More detailed error logging for debugging
    if (error.code) {
      console.error('Database error code:', error.code);
    }
    
    return res.status(500).json({
      error: "Failed to fetch contest leaderboard",
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false,
    });
  }
}
};

// Option Controller
const optionController = {
  // Create a new option
  async createOption(req, res) {
    try {
      const { symbol, expiryDate, strikePrice, optionType, ltp, lotSize } =
        req.body;

      // Validate required fields
      if (
        !symbol ||
        !expiryDate ||
        !strikePrice ||
        !optionType ||
        !ltp ||
        !lotSize
      ) {
        return res.status(400).json({
          error: "Missing required fields",
          details:
            "All fields are required: symbol, expiryDate, strikePrice, optionType, ltp, lotSize",
        });
      }

      // Create option with proper data formatting
      const option = await prisma.option.create({
        data: {
          symbol: symbol.toString() || "jjj", // Ensure symbol is stored as string
          expiry_date: expiryDate,
          strike_price: strikePrice,
          option_type: optionType,
          ltp: ltp,
          lot_size: parseInt(lotSize),
          updated_at: new Date(),
        },
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
          updatedAt: option.updated_at,
        },
      });
    } catch (error) {
      console.error("Option creation error:", error);
      res.status(400).json({
        error: "Failed to create option",
        details: error.message,
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
      const { optionId, quantity, averagePrice, contestId } = req.body;
      const userId = parseInt(req.user.userId);

      // First find the contest participant
      const contestParticipant = await prisma.contestParticipant.findFirst({
        where: {
          user_id: userId,
          contest_id: parseInt(contestId),
          contest: {
            status: "ongoing",
          },
        },
      });

      if (!contestParticipant) {
        return res.status(404).json({
          error: "Contest participant not found",
          details:
            "You are not participating in this contest or the contest is not active",
        });
      }

      // Validate inputs
      if (!optionId || !quantity || !averagePrice) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Parse values
      const parsedOptionId = parseInt(optionId);
      const parsedQuantity = parseInt(quantity);
      const parsedPrice = parseFloat(averagePrice);

      // Validate parsed values
      if (
        isNaN(parsedOptionId) ||
        isNaN(parsedQuantity) ||
        isNaN(parsedPrice)
      ) {
        return res.status(400).json({ error: "Invalid input values" });
      }

      // Create position with proper relations
      const position = await prisma.position.create({
        data: {
          net_quantity: parsedQuantity,
          average_entry_price: parsedPrice,
          contestParticipant: {
            connect: {
              id: contestParticipant.id,
            },
          },
          option: {
            connect: {
              id: parsedOptionId,
            },
          },
        },
        include: {
          contestParticipant: {
            include: {
              contest: true,
              user: true,
            },
          },
          option: true,
        },
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
            optionType: position.option.option_type,
          },
          contest: {
            id: position.contestParticipant.contest.id,
            name: position.contestParticipant.contest.name,
          },
        },
      });
    } catch (error) {
      console.error("Position creation error:", error);
      res.status(400).json({
        error: "Failed to create position",
        details: error.message,
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
      console.log(req.user);
      // Validate required fields
      if (!optionId || !contestId || !action || !quantity || !price) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "All fields are required: optionId, contestId, action, quantity, price",
        });
      }

      // Parse inputs safely
      const parsedOptionId = parseInt(optionId);
      const parsedContestId = parseInt(contestId);
      const parsedQuantity = parseInt(quantity);
      const parsedPrice = parseFloat(price);

      // Validate parsed values
      if (
        isNaN(parsedOptionId) ||
        isNaN(parsedContestId) ||
        isNaN(parsedQuantity) ||
        isNaN(parsedPrice)
      ) {
        return res.status(400).json({
          error: "Invalid input values",
          details: "All numeric fields must be valid numbers",
        });
      }

      // Find specific contest participation
      const contestParticipant = await prisma.contestParticipant.findFirst({
        where: {
          user_id: userId,
          contest_id: contestId,
          // contest: {
          //   status: "ongoing",
          // },
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

      console.log("Contest Participant:", contestParticipant);
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
      if (
        contestTrades.length >= parseInt(contestParticipant.contest.maxTrade)
      ) {
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
              id: contestParticipant.id,
            },
          },
          option: {
            connect: {
              id: parsedOptionId, // Now properly parsed
            },
          },
          action: action,
          quantity: parsedQuantity,
          price: parsedPrice,
        },
        include: {
          contestParticipant: true,
          option: true,
        },
      });

      // Update virtual cash
      const cashUpdate = action === "buy" ? -tradeValue : tradeValue;
      await prisma.contestParticipant.update({
        where: {
          id: contestParticipant.id,
        },
        data: {
          virtual_cash: {
            increment: cashUpdate,
          },
        },
      });

      // Return success response
      res.status(201).json({
        success: true,
        trade: trade,
        contestStatus: {
          contestId: parsedContestId,
          tradesUsed: contestTrades.length + 1,
          tradesRemaining:
            parseInt(contestParticipant.contest.maxTrade) -
            (contestTrades.length + 1),
          virtualCashBefore: parseFloat(contestParticipant.virtual_cash),
          virtualCashAfter:
            parseFloat(contestParticipant.virtual_cash) + cashUpdate,
          tradeValue: tradeValue,
        },
      });
    } catch (error) {
      console.error("Trade creation error:", error);
      res.status(400).json({
        error: "Failed to create trade",
        details: error.message,
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
      const { amount, type, status, transaction_id, payment_method,upi_ref_no } = req.body;
console.log(upi_ref_no);
      // Validate input
      if (!amount || !type || !status ) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Validate transaction_id for CREDIT transactions
      if (type === "CREDIT" && !transaction_id && !upi_ref_no) {
        return res.status(400).json({ error: "Transaction ID is required for credit transactions" });
      }

      const parsedUserId = parseInt(req.user.userId);
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedUserId) || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid user_id or amount" });
      }

      // Check for duplicate transaction_id
      if (transaction_id) {
        const existingTransaction = await prisma.walletTransaction.findMany({
          where: {transaction_id: transaction_id },
        });
        if (existingTransaction.transaction_id=== transaction_id) {
          return res.status(400).json({ error: "Duplicate transaction ID" });
        }
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
            type === "CREDIT"
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
          upi_ref_no:parseInt(upi_ref_no),
          transaction_id: transaction_id || null,
          payment_method: payment_method || null,
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
      res.status(400).json({
        error: "Failed to create transaction",
        details: error.message,
      });
    }
  },

  // Get all wallet transactions
  async getAllWalletTransactions(req, res) {
    try {
      const isAdmin = req.user.role === 'admin';
      let transactions;
      if (isAdmin) {
        // Admin: fetch all transactions for all users
        transactions = await prisma.walletTransaction.findMany({
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                upiId: true,
                id: true,
              },
            },
          },
          orderBy: {
            created_at: "desc",
          },
        });
      } else {
        // Not admin: fetch only current user's transactions
        const userId = parseInt(req.user.userId);
        transactions = await prisma.walletTransaction.findMany({
          where: {
            user_id: userId,
          },
          orderBy: {
            created_at: "desc",
          },
        });
      }

      // Format the response
      const formattedTransactions = transactions.map((transaction) => {
        const base = transaction;
        if (isAdmin && transaction.user) {
          base.user = {
            name: `${transaction.user.firstName} ${transaction.user.lastName}`,
            email: transaction.user.email,
            upiId: transaction.user.upiId || null,
            id: transaction.user.id,
          };
        }
        return base;
      });

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

  // Get transaction by transaction_id
  async getWalletTransactionByTransactionId(req, res) {
    try {
      const { transaction_id } = req.params;
      const transaction = await prisma.walletTransaction.findFirst({
        where: { transaction_id },
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
      const { amount, type, status, payment_method } = req.body;
      
      // Don't allow updating transaction_id
      const transaction = await prisma.walletTransaction.update({
        where: { id: parseInt(id) },
        data: {
          amount: amount ? parseFloat(amount) : undefined,
          type,
          status,
          payment_method,
        },
      });
      res.status(200).json(transaction);
    } catch (error) {
      res.status(400).json({
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
      res.status(400).json({
        error: "Failed to delete transaction",
        details: error.message,
      });
    }
  },

  // Get all withdrawal transactions (admin: all, user: only own)
  async getAllWithdrawalTransactions(req, res) {
    try {
      const isAdmin = req.user.role === 'admin';
      let transactions;
      if (isAdmin) {
        // Admin: fetch all withdrawal transactions
        transactions = await prisma.walletTransaction.findMany({
          where: {
            type: 'DEBIT',
            payment_method: 'WITHDRAWAL',
          },
          orderBy: { created_at: 'desc' },
        });
      } else {
        // User: fetch only own withdrawal transactions
        transactions = await prisma.walletTransaction.findMany({
          where: {
            user_id: req.user.userId,
            type: 'DEBIT',
            payment_method: 'WITHDRAWAL',
          },
          orderBy: { created_at: 'desc' },
        });
      }
      res.json({ success: true, count: transactions.length, transactions });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
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
