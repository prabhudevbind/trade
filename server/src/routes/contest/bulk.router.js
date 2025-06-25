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
    const utrMatches = text.match(/UTR No\.?\s*\d+/g) || [];
    const amountMatches = text.match(/₹(\d+(?:\.\d{2})?)/g);
    const typeMatches = text.match(/(CREDIT|DEBIT)/g);
  
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
     
    // N × M APPROACH: Check every PDF record against every DB record
    const allUnverifiedTransactions = await prisma.walletTransaction.findMany({
      where: { payment_verify: false }
    });

    console.log(`Total unverified transactions: ${allUnverifiedTransactions.length}`);
    console.log(`Total PDF records to process: ${minLength}`);
    console.log(`Total comparisons to perform: ${minLength} × ${allUnverifiedTransactions.length} = ${minLength * allUnverifiedTransactions.length}`);

    // Process all PDF records (n × m approach)
    for (let i = 0; i < minLength; i++) {
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

    //   console.log(`\n=== Processing PDF Record ${i + 1}/${minLength} ===`);
    //   console.log(`PDF Data: UTR="${utrNumber}", Amount=${amount}, Type="${transactionType}"`);
      
      let matchFound = false;
      
      // Check against ALL database records (n × m)
      for (let j = 0; j < allUnverifiedTransactions.length; j++) {
        const t = allUnverifiedTransactions[j];
        
        // console.log(`  Checking against DB Record ${j + 1}/${allUnverifiedTransactions.length} (ID: ${t.id})`);
        
        // Handle Prisma Decimal objects properly
        let dbUtrString = '';
        if (t.upi_ref_no) {
          if (typeof t.upi_ref_no === 'object' && t.upi_ref_no.toString) {
            // Prisma Decimal object
            dbUtrString = t.upi_ref_no.toString();
          } else {
            // Regular string or number
            dbUtrString = t.upi_ref_no.toString();
          }
        }
        
        let dbAmount = 0;
        if (t.amount) {
          if (typeof t.amount === 'object' && t.amount.toString) {
            // Prisma Decimal object
            dbAmount = parseFloat(t.amount.toString());
          } else {
            // Regular string or number
            dbAmount = parseFloat(t.amount.toString());
          }
        }
        
        // Perform matching
        const pdfUtrString = utrNumber.toString();
        const pdfAmount = parseFloat(amount);
        
        const utrMatch = dbUtrString === pdfUtrString;
        const amountMatch = Math.abs(dbAmount - pdfAmount) < 0.01;
        const typeMatch = t.type && t.type.toUpperCase() === transactionType.toUpperCase();
        
        // console.log(`    DB UTR: "${dbUtrString}" vs PDF UTR: "${pdfUtrString}" -> ${utrMatch ? '✅' : '❌'}`);
        // console.log(`    DB Amount: ${dbAmount} vs PDF Amount: ${pdfAmount} -> ${amountMatch ? '✅' : '❌'}`);
        // console.log(`    DB Type: "${t.type}" vs PDF Type: "${transactionType}" -> ${typeMatch ? '✅' : '❌'}`);
        
        if (utrMatch && amountMatch && typeMatch) {
        //   console.log(`    🎯 PERFECT MATCH FOUND! Transaction ID: ${t.id}`);
          
          try {
            await prisma.walletTransaction.update({
              where: { id: t.id },
              data: {
                payment_verify: true,
                verified_at: new Date()
              }
            });
            
            verifiedTransactions.push({
              transactionId: t.id,
              utrNumber,
              amount,
              type: transactionType
            });
            
            // console.log(`    ✅ Transaction ${t.id} marked as verified`);
            matchFound = true;
            break; // Stop checking other DB records for this PDF record
          } catch (error) {
            // console.log(`    ❌ Database update failed: ${error.message}`);
            failedMatches.push({
              utrNumber,
              amount,
              type: transactionType,
              reason: 'Database error: ' + error.message
            });
          }
        }
      }
      
      if (!matchFound) {
        // console.log(`    ❌ NO MATCH FOUND for PDF record ${i + 1}`);
        failedMatches.push({
          utrNumber,
          amount,
          type: transactionType,
          reason: 'No matching unverified transaction found after checking all DB records'
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
    // console.error("PDF processing error:", err);
    res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
});

// FIXED: Alternative endpoint for single transaction verification
router.post("/verify-single", async (req, res) => {
  try {
    const { utr_number, amount, type } = req.body;

    if (!utr_number || !amount || !type) {
      return res.status(400).json({
        error: "UTR number, amount, and type are required",
      });
    }

    // NOTE: Quick verification does NOT match any official bank statement.
    // If you verify using this method, it is your responsibility to ensure the transaction is legitimate.
    // Use the PDF upload verification for official statement matching.

    // FIXED: Use proper Decimal conversion for Prisma query
    const transaction = await prisma.walletTransaction.findFirst({
      where: {
        upi_ref_no: parseFloat(utr_number), // Convert to number for Decimal field
        amount: parseFloat(amount), // Convert to number for Decimal field
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