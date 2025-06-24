const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const prisma = require("../../utils/prisma");
const router = express.Router();

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/contest/bulk/upload-pdf
router.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    // Parse PDF
    const data = await pdfParse(req.file.buffer);
    const text = data.text;

    // Extract UTR number, amount, and type from PDF text
    // Updated regex patterns to match the transaction statement format
  const utrMatches = text.match(/UTR No\.?\s*\d+/g) || [];
    const amountMatches = text.match(/₹(\d+(?:\.\d{2})?)/g);
    const typeMatches = text.match(/(CREDIT|DEBIT)/g);
    console.log("UTR Matches:", utrMatches);
    console.log("Amount Matches:", amountMatches);
    console.log("Type Matches:", typeMatches);
    if (!utrMatches || !amountMatches || !typeMatches) {
      return res.status(400).json({
        error: "Could not extract required data (UTR, Amount, Type) from PDF",
        debug: {
          utrFound: !!utrMatches,
          amountFound: !!amountMatches,
          typeFound: !!typeMatches,
        },
      });
    }

    // Process each transaction found in the PDF
    const verifiedTransactions = [];
    const failedMatches = [];

    // Assuming each transaction has UTR, amount, and type in sequence
    const minLength = Math.min(
      utrMatches.length,
      amountMatches.length,
      typeMatches.length
    );
    
const utrNumbers = utrMatches.map(s => s.split('UTR No.')[1].trim());
     
    for (let i = 0; i < minLength; i++) {
      // Extract only the number part from the UTR string
      const utrString = utrMatches[i];
      const utrNumberMatch = utrString.match(/UTR No\.?\s*(\d+)/);
      const utrNumber = utrNumberMatch ? utrNumberMatch[1] : null;
      const amount = parseFloat(amountMatches[i].replace('₹', ''));
      const transactionType = typeMatches[i];

      if (!utrNumber) {
        failedMatches.push({
          utrString,
          amount,
          type: transactionType,
          reason: 'Could not extract UTR number'
        });
        continue;
      }

      try {
        // Find wallet transaction matching UTR, amount, and type exactly
        const transaction = await prisma.walletTransaction.findFirst({
          where: {
            utr_number: utrNumber,
            amount: amount,
            type: transactionType,
            payment_verify: false
          }
        });

        if (transaction) {
          // Mark as verified
          await prisma.walletTransaction.update({
            where: { id: transaction.id },
            data: { 
              payment_verify: true,
              verified_at: new Date()
            }
          });

          verifiedTransactions.push({
            transactionId: transaction.id,
            utrNumber,
            amount,
            type: transactionType
          });
        } else {
          failedMatches.push({
            utrNumber,
            amount,
            type: transactionType,
            reason: 'No matching unverified transaction found'
          });
        }
      } catch (error) {
        failedMatches.push({
          utrNumber,
          amount,
          type: transactionType,
          reason: 'Database error: ' + error.message
        });
      }
    }

    // Return comprehensive response
    const response = {
      success: verifiedTransactions.length > 0,
      message: `${verifiedTransactions.length} transaction(s) verified successfully`,
      verifiedTransactions,
      failedMatches,
      totalProcessed: minLength,
    };

    if (verifiedTransactions.length === 0) {
      return res.status(404).json({
        ...response,
        error: "No matching transactions found for verification",
      });
    }

    res.json(response);
  } catch (err) {
    console.error("PDF processing error:", err);
    res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
});

// Alternative endpoint for single transaction verification
router.post("/verify-single", async (req, res) => {
  try {
    const { utr_number, amount, type } = req.body;

    if (!utr_number || !amount || !type) {
      return res.status(400).json({
        error: "UTR number, amount, and type are required",
      });
    }

    // Find exact match
    const transaction = await prisma.walletTransaction.findFirst({
      where: {
        utr_number: utr_number.toString(),
        amount: parseFloat(amount),
        type: type.toUpperCase(),
        payment_verify: false,
      },
    });

    if (!transaction) {
      return res.status(404).json({
        error: "No matching unverified transaction found",
        searchCriteria: { utr_number, amount, type },
      });
    }

    // Mark as verified
    await prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        payment_verify: true,
        verified_at: new Date(),
      },
    });

    res.json({
      success: true,
      message: "Transaction verified successfully",
      transactionId: transaction.id,
      verifiedTransaction: {
        utr_number,
        amount,
        type,
      },
    });
  } catch (err) {
    console.error("Single verification error:", err);
    res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
});

module.exports = router;
