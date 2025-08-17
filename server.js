// server.js
const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

// Load Firebase service account from Render environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://bynexproject.firebaseio.com"
});

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json()); // Parse JSON body

// 🔹 Callback endpoint for PayHero STK Push
app.post("/callback", async (req, res) => {
  try {
    // PayHero usually sends data in req.body
    const { Amount, MpesaReceiptNumber, Phone, ExternalReference, Status } =
      req.body;

    // Build transaction object
    const transactionData = {
      Amount: Amount || 0,
      MpesaReceiptNumber: MpesaReceiptNumber || "",
      Phone: Phone || "",
      ExternalReference: ExternalReference || `REF-${Date.now()}`,
      Status: Status || "Failed",
      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save to Firestore under "tests" collection
    const docRef = await db.collection("tests").add(transactionData);

    console.log("✅ Transaction saved with ID:", docRef.id);

    // Respond success to PayHero
    res.status(200).json({
      success: true,
      message: "Transaction received and saved",
      docId: docRef.id,
    });
  } catch (error) {
    console.error("❌ Error saving transaction:", error);
    res.status(500).json({ success: false, error: "Failed to save transaction" });
  }
});

// Root route
app.get("/", (req, res) => {
  res.send("PayHero Callback Server is running ✅");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
