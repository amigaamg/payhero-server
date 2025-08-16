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

const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Fixed PayHero callback endpoint
app.post('/payhero/callback', async (req, res) => {
    const data = req.body;
    console.log('Incoming PayHero Callback:', JSON.stringify(data, null, 2));

    try {
        // FIX 1: Access nested response object
        const response = data.response || {};
        
        // FIX 2: Get values from response object
        const statusCode = response.ResultCode ?? response.resultCode;
        const transCode = response.MpesaReceiptNumber ?? response.CheckoutRequestID ?? 'NO-CODE';
        const amount = response.Amount ?? response.amount ?? 0;
        const phone = response.MSISDN ?? response.Phone ?? 'UNKNOWN';
        
        // FIX 3: Ensure reference is always a valid string
        let reference = response.ExternalReference || 
                      response.external_reference || 
                      response.CheckoutRequestID ||
                      `FALLBACK_${Date.now()}`;  // Fallback if all missing
        
        // FIX 4: Remove invalid characters from reference
        reference = reference.toString().replace(/[^a-zA-Z0-9_-]/g, '');

        const paymentRecord = {
            transCode,
            amount,
            phone,
            status: statusCode === 0 ? 'success' : 'failed',
            callbackData: data,
            timestamp: admin.firestore.FieldValue.serverTimestamp()  // Better timestamp
        };

        // FIX 5: Add validation before saving
        if (!reference || reference.trim() === '') {
            reference = `INVALID_REF_${Date.now()}`;
        }

        console.log(`Saving to Firestore with reference: ${reference}`);
        await db.collection('tests').doc(reference).set(paymentRecord);
        console.log(`Payment recorded: ${statusCode === 0 ? 'SUCCESS' : 'FAILED'} - ${transCode}`);

        res.status(200).send('Received');
    } catch (err) {
        console.error("Error saving payment to Firebase:", err);
        res.status(500).send('Server error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PayHero server running on port ${PORT}`));