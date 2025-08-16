// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Firebase Admin setup
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.error("ERROR: Environment variable GOOGLE_APPLICATION_CREDENTIALS_JSON is missing!");
  process.exit(1);
}

// Parse service account JSON from env variable
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
} catch (err) {
  console.error("ERROR: Failed to parse Firebase credentials JSON:", err);
  process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PayHero callback endpoint
app.post('/payhero/callback', async (req, res) => {
  const data = req.body;
  console.log('Incoming PayHero Callback:', JSON.stringify(data, null, 2));

  try {
    // Access nested response object if exists
    const response = data.response || {};

    const statusCode = response.ResultCode ?? response.resultCode ?? 1; // default fail
    const transCode = response.MpesaReceiptNumber ?? response.CheckoutRequestID ?? 'NO-CODE';
    const amount = response.Amount ?? response.amount ?? 0;
    const phone = response.MSISDN ?? response.Phone ?? 'UNKNOWN';

    // Use external reference or fallback for document ID
    let reference = response.ExternalReference ??
                    response.external_reference ??
                    response.CheckoutRequestID ??
                    `FALLBACK_${Date.now()}`;

    // Remove invalid characters from document ID
    reference = reference.toString().replace(/[^a-zA-Z0-9_-]/g, '') || `INVALID_${Date.now()}`;

    // Payment record
    const paymentRecord = {
      transCode,
      amount,
      phone,
      status: statusCode === 0 ? 'success' : 'failed',
      callbackData: data,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    // Save to Firestore under collection "tests"
    await db.collection('tests').doc(reference).set(paymentRecord);

    console.log(`Payment recorded: ${statusCode === 0 ? 'SUCCESS' : 'FAILED'} - ${transCode}`);

    res.status(200).send('Received');
  } catch (err) {
    console.error("Error saving payment to Firebase:", err);
    res.status(500).send('Server error');
  }
});

// Optional: simple health check
app.get('/', (req, res) => res.send('PayHero server is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PayHero server running on port ${PORT}`));
