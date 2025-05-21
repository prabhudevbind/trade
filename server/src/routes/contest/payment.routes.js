const express = require("express");
const Razorpay = require("razorpay");
const router = express.Router();
const prisma = require('../../utils/prisma');

const razorpay = new Razorpay({
  key_id: "rzp_test_4kJGZ6vUcstgUm",
  key_secret: "Di3r7vCoOb3t7E1UYJ8v9K6P",
});

// Route to create an order
router.post("/createOrder", async (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ error: "Amount and currency are required" });
    }

    const options = {
      amount: amount * 100, // amount in the smallest currency unit
      currency: currency,
      receipt: `receipt_order_${Math.floor(Math.random() * 1000000)}`,
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to fetch payment details by email
router.post("/paymentDetails", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Fetch wallet transactions for the user with the given email
    const payments = await prisma.walletTransaction.findMany({
      where: {
        user: {
          email: email,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to fetch all payments in a date range
router.get("/allPayments", async (req, res) => {
  try {
    const { from, to } = req.query;

    // Validate date inputs
    if (!from || !to) {
      return res.status(400).json({ error: "From and to dates are required" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    // Fetch wallet transactions within the date range
    const payments = await prisma.walletTransaction.findMany({
      where: {
        created_at: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;