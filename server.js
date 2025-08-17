const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

const app = express();
app.use(bodyParser.json());

// Initialize Firebase with environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

const db = admin.firestore();

// Callback route for PayHero
app.post("/callback", async (req, res) => {
  try {
    const transaction = {
      Amount: req.body.Amount || 0,
      MpesaReceiptNumber: req.body.MpesaReceiptNumber || "",
      Phone: req.body.Phone || "",
      ExternalReference: req.body.ExternalReference || "",
      Status: req.body.Status || "Failed",
      Timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("tests").add(transaction);

    res.status(200).send({ success: true });
  } catch (error) {
    console.error("Error saving transaction:", error);
    res.status(500).send({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
