const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// API endpoint to fetch option chain (initial data)
router.get("/option-chain", async (req, res) => {
  try {
    const { expiry_date, instrument_key = "NSE_INDEX|Nifty 50" } = req.query;

    if (!expiry_date) {
      return res.status(400).json({
        success: false,
        message: "expiry_date is required",
      });
    }

    const url = `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(
      instrument_key
    )}&expiry_date=${expiry_date}`;
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    };

    const response = await axios.get(url, { headers });
    const optionData = response.data.data || [];

    if (optionData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No option chain data found for the given parameters",
      });
    }

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(__dirname, "data", `nifty_options_data_${timestamp}.json`);
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(optionData, null, 2));
    console.log(`✅ Data successfully saved to ${filePath}`);

    res.json({
      success: true,
      data: optionData,
      message: `Option chain data fetched and saved to ${filePath}`,
    });
  } catch (error) {
    console.error("❌ API Error:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch option chain",
      error: error.message,
    });
  }
});

// API endpoint for streaming option chain data (1-second updates)
router.get("/option-chain-stream", async (req, res) => {
  try {
    const { expiry_date, instrument_key = "NSE_INDEX|Nifty 50" } = req.query;

    if (!expiry_date) {
      res.status(400).json({
        success: false,
        message: "expiry_date is required",
      });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Fetch and stream data every 1 second
    const interval = setInterval(async () => {
      try {
        const url = `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(
          instrument_key
        )}&expiry_date=${expiry_date}`;
        const headers = {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
        };

        const response = await axios.get(url, { headers });
        const optionData = response.data.data || [];

        if (optionData.length === 0) {
          res.write(
            `data: ${JSON.stringify({
              success: false,
              message: "No option chain data found for the given parameters",
            })}\n\n`
          );
          return;
        }

        // Save to file
        // const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        // const filePath = path.join(__dirname, "data", `nifty_options_data_${timestamp}.json`);
        // const dataDir = path.join(__dirname, "data");
        // if (!fs.existsSync(dataDir)) {
        //   fs.mkdirSync(dataDir, { recursive: true });
        // }
        // fs.writeFileSync(filePath, JSON.stringify(optionData, null, 2));
        // console.log(`✅ Data successfully saved to ${filePath}`);

        // Send data to client
        res.write(
          `data: ${JSON.stringify({
            success: true,
            data: optionData,
            // message: `Option chain data fetched and saved to ${filePath}`,
          })}\n\n`
        );
      } catch (error) {
        console.error("❌ Streaming API Error:", error.message);
        res.write(
          `data: ${JSON.stringify({
            success: false,
            message: "Failed to fetch option chain",
            error: error.message,
          })}\n\n`
        );
      }
    }, 1000); // 1-second interval

    // Handle client disconnection
    req.on("close", () => {
      clearInterval(interval);
      res.end();
      console.log("✅ Client disconnected from SSE stream");
    });
  } catch (error) {
    console.error("❌ SSE Setup Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to set up streaming",
      error: error.message,
    });
  }
});

module.exports = router;