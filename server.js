const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

const app = express();
app.use(bodyParser.json());

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

// === PayHero Callback ===
app.post("/callback", async (req, res) => {
  try {
    console.log("Callback received:", req.body);

    // Extract transaction details (depending on PayHero structure)
    const transaction = {
      Amount: req.body.Amount || 0,
      MpesaReceiptNumber: req.body.MpesaReceiptNumber || "N/A",
      Phone: req.body.Phone || "N/A",
      ExternalReference: req.body.ExternalReference || "N/A",
      Status: req.body.Status || "Failed",
      RawResponse: req.body, // store full payload for debugging
      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save to Firestore (collection: tests)
    await db.collection("tests").add(transaction);

    console.log("Transaction saved:", transaction);

    // Respond to PayHero
    res.status(200).json({ success: true, message: "Transaction saved" });
  } catch (error) {
    console.error("Error saving transaction:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Root route
app.get("/", (req, res) => {
  res.send("✅ PayHero Callback Server is running...");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
