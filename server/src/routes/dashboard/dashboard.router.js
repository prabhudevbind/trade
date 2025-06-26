const express = require("express");
const router = express.Router();
const prisma = require('../../utils/prisma');

// ===========================================
// DASHBOARD ANALYTICS & STATISTICS
// ===========================================

// Get comprehensive dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalContests,
      activeContests,
      totalTransactions,
      totalTransactionAmount,
      totalParticipants,
      todayRegistrations,
      todayTransactions,
      pendingWithdrawals
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Active users (logged in within last 30 days)
      prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Total contests
      prisma.contest.count(),
      
      // Active contests
      prisma.contest.count({
        where: {
          status: 'ongoing'
        }
      }),
      
      // Total transactions
      prisma.walletTransaction.count(),
      
      // Total transaction amount
      prisma.walletTransaction.aggregate({
        _sum: {
          amount: true
        },
        where: {
          status: 'COMPLETED'
        }
      }),
      
      // Total contest participants
      prisma.contestParticipant.count(),
      
      // Today's registrations
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      
      // Today's transactions
      prisma.walletTransaction.count({
        where: {
          created_at: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      
      // Pending withdrawals
      prisma.walletTransaction.count({
        where: {
          type: 'WITHDRAWAL',
          status: 'PENDING'
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          todayRegistrations
        },
        contests: {
          total: totalContests,
          active: activeContests,
          totalParticipants
        },
        transactions: {
          total: totalTransactions,
          totalAmount: totalTransactionAmount._sum.amount || 0,
          todayCount: todayTransactions,
          pendingWithdrawals
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
});

// Get user growth chart data (last 30 days)
router.get('/dashboard/charts/user-growth', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const userGrowth = await prisma.$queryRaw`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as count,
        SUM(COUNT(*)) OVER (ORDER BY DATE(createdAt)) as cumulative
      FROM User
      WHERE createdAt >= ${thirtyDaysAgo}
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `;

    res.json({
      success: true,
      data: userGrowth
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user growth data',
      error: error.message
    });
  }
});

// Get transaction chart data
router.get('/dashboard/charts/transactions', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const daysAgo = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);
    
    const transactionData = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM WalletTransaction
      WHERE created_at >= ${daysAgo}
      GROUP BY DATE(created_at), type
      ORDER BY date ASC, type
    `;

    res.json({
      success: true,
      data: transactionData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction data',
      error: error.message
    });
  }
});

// Get contest participation chart data
router.get('/dashboard/charts/contest-participation', async (req, res) => {
  try {
    const contestData = await prisma.contest.findMany({
      select: {
        id: true,
        name: true,
        start_time: true,
        end_time: true,
        status: true,
        _count: {
          select: {
            contestParticipants: true
          }
        }
      },
      orderBy: {
        start_time: 'desc'
      },
      take: 10
    });

    res.json({
      success: true,
      data: contestData.map(contest => ({
        id: contest.id,
        name: contest.name,
        startTime: contest.start_time,
        endTime: contest.end_time,
        status: contest.status,
        participants: contest._count.contestParticipants
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching contest participation data',
      error: error.message
    });
  }
});

// ===========================================
// USER MANAGEMENT
// ===========================================

// Get all users with pagination and filters
router.get('/users', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      role = '', 
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    // Search filter
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } }
      ];
    }

    // Role filter
    if (role) {
      where.role = { name: role };
    }

    // Status filter
    if (status) {
      where.isActive = status === 'active';
    }

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: true,
          _count: {
            select: {
              contestParticipants: true,
              walletTransactions: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// Get single user details
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: {
        role: true,
        contestParticipants: {
          include: {
            contest: true
          }
        },
        walletTransactions: {
          orderBy: { created_at: 'desc' },
          take: 10
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user details',
      error: error.message
    });
  }
});

// Update user status
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { isActive },
      include: { role: true }
    });

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: error.message
    });
  }
});

// ===========================================
// CONTEST MANAGEMENT
// ===========================================

// Get all contests
router.get('/contests', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = '',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (status) {
      where.status = status;
    }

    const [contests, totalCount] = await Promise.all([
      prisma.contest.findMany({
        where,
        include: {
          _count: {
            select: {
              contestParticipants: true,
              contestWinners: true
            }
          },
          price: true
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.contest.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        contests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching contests',
      error: error.message
    });
  }
});

// Create new contest
router.post('/contests', async (req, res) => {
  try {
    const {
      name,
      start_time,
      end_time,
      maxTrade,
      entry_fee,
      trading_instrument,
      prizeDistribution
    } = req.body;

    const contest = await prisma.contest.create({
      data: {
        name,
        start_time: new Date(start_time),
        end_time: new Date(end_time),
        maxTrade,
        entry_fee,
        trading_instrument,
        price: {
          create: prizeDistribution
        }
      },
      include: {
        price: true
      }
    });

    res.json({
      success: true,
      message: 'Contest created successfully',
      data: contest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating contest',
      error: error.message
    });
  }
});

// Update contest
router.patch('/contests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.start_time) {
      updateData.start_time = new Date(updateData.start_time);
    }
    if (updateData.end_time) {
      updateData.end_time = new Date(updateData.end_time);
    }

    const contest = await prisma.contest.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        price: true,
        _count: {
          select: {
            contestParticipants: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Contest updated successfully',
      data: contest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating contest',
      error: error.message
    });
  }
});

// ===========================================
// TRANSACTION MANAGEMENT
// ===========================================

// Get all transactions
router.get('/transactions', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type = '', 
      status = '',
      userId = '',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (type) where.type = type;
    if (status) where.status = status;
    if (userId) where.user_id = parseInt(userId);

    const [transactions, totalCount] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.walletTransaction.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
});

// Update transaction status
router.patch('/transactions/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, verified_at } = req.body;

    const updateData = { status };
    if (verified_at) {
      updateData.verified_at = new Date(verified_at);
    }

    const transaction = await prisma.walletTransaction.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    // Update user amount if transaction is approved
    if (status === 'APPROVED' && transaction.type === 'DEPOSIT') {
      await prisma.user.update({
        where: { id: transaction.user_id },
        data: {
          amounts: {
            increment: transaction.amount
          }
        }
      });
    }

    res.json({
      success: true,
      message: 'Transaction status updated successfully',
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating transaction status',
      error: error.message
    });
  }
});

// ===========================================
// TRADING & POSITIONS
// ===========================================

// Get trading overview
router.get('/trading/overview', async (req, res) => {
  try {
    const [
      totalTrades,
      totalPositions,
      activePositions,
      tradingVolume
    ] = await Promise.all([
      prisma.trade.count(),
      prisma.position.count(),
      prisma.position.count({
        where: {
          net_quantity: {
            not: 0
          }
        }
      }),
      prisma.trade.aggregate({
        _sum: {
          price: true
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalTrades,
        totalPositions,
        activePositions,
        tradingVolume: tradingVolume._sum.price || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching trading overview',
      error: error.message
    });
  }
});

// Get recent trades
router.get('/trading/recent-trades', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const trades = await prisma.trade.findMany({
      include: {
        contestParticipant: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
              }
            },
            contest: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        option: true
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: parseInt(limit)
    });

    res.json({
      success: true,
      data: trades
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching recent trades',
      error: error.message
    });
  }
});

// ===========================================
// SYSTEM MANAGEMENT
// ===========================================

// Get system health
router.get('/system/health', async (req, res) => {
  try {
    const [
      dbStatus,
      totalRecords
    ] = await Promise.all([
      prisma.$queryRaw`SELECT 1 as status`,
      prisma.$queryRaw`
        SELECT 
          'users' as table_name, COUNT(*) as count FROM User
        UNION ALL
        SELECT 'contests', COUNT(*) FROM Contest
        UNION ALL
        SELECT 'transactions', COUNT(*) FROM WalletTransaction
        UNION ALL
        SELECT 'trades', COUNT(*) FROM Trade
      `
    ]);

    res.json({
      success: true,
      data: {
        database: 'connected',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        tables: totalRecords
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'System health check failed',
      error: error.message
    });
  }
});

// Get activity logs
router.get('/system/activity-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, userId = '', activityType = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (userId) where.userId = parseInt(userId);
    if (activityType) where.activityType = activityType;

    const [logs, totalCount] = await Promise.all([
      prisma.userActivityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.userActivityLog.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching activity logs',
      error: error.message
    });
  }
});

// Export data (CSV format)
router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate } = req.query;

    let data = [];
    let filename = '';

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    switch (type) {
      case 'users':
        data = await prisma.user.findMany({
          where: dateFilter.gte ? { createdAt: dateFilter } : {},
          include: { role: true }
        });
        filename = 'users_export.csv';
        break;

      case 'transactions':
        data = await prisma.walletTransaction.findMany({
          where: dateFilter.gte ? { created_at: dateFilter } : {},
          include: { user: { select: { username: true, email: true } } }
        });
        filename = 'transactions_export.csv';
        break;

      case 'contests':
        data = await prisma.contest.findMany({
          where: dateFilter.gte ? { created_at: dateFilter } : {},
          include: { _count: { select: { contestParticipants: true } } }
        });
        filename = 'contests_export.csv';
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    // Convert to CSV (simplified - you might want to use a proper CSV library)
    const csvData = data.map(item => JSON.stringify(item)).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvData);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting data',
      error: error.message
    });
  }
});

module.exports = router;