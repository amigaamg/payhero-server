// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Firebase Admin setup using environment variable
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

// PayHero callback endpoint
app.post('/payhero/callback', async (req, res) => {
    const data = req.body;
    console.log('Incoming PayHero Callback:', JSON.stringify(data, null, 2));

    try {
        // Handle both direct callback and nested response structure
        const callbackData = data.response || data;
        
        const statusCode = callbackData.ResultCode ?? callbackData.resultCode ?? data.ResultCode ?? data.resultCode;
        const transCode = callbackData.MpesaReceiptNumber ?? callbackData.CheckoutRequestID ?? data.MpesaReceiptNumber ?? data.CheckoutRequestID ?? 'NO-CODE';
        const amount = callbackData.Amount ?? callbackData.amount ?? data.Amount ?? data.amount ?? 0;
        const phone = callbackData.MSISDN ?? callbackData.Phone ?? data.MSISDN ?? data.Phone ?? 'UNKNOWN';
        
        // Try multiple ways to get the reference
        let reference = callbackData.ExternalReference ?? callbackData.external_reference ?? 
                       data.ExternalReference ?? data.external_reference ?? 
                       callbackData.CheckoutRequestID ?? data.CheckoutRequestID;

        // Ensure reference is valid and not empty
        if (!reference || reference.trim() === '') {
            reference = `FALLBACK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            console.warn('No valid reference found, using fallback:', reference);
        }

        console.log('Extracted values:', {
            statusCode,
            transCode, 
            amount,
            phone,
            reference
        });

        const paymentRecord = {
            transCode,
            amount: Number(amount),
            phone,
            status: statusCode === 0 ? 'success' : 'failed',
            callbackData: data, // Store the full original callback
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            reference: reference
        };

        // Save in Firebase using reference as document ID
        await db.collection('tests').doc(reference).set(paymentRecord, { merge: true });

        console.log(`Payment recorded: ${statusCode === 0 ? 'SUCCESS' : 'FAILED'} - ${transCode} - Doc ID: ${reference}`);

        res.status(200).send('Received');
    } catch (err) {
        console.error("Error saving payment to Firebase:", err);
        console.error("Request body:", JSON.stringify(data, null, 2));
        res.status(500).send('Server error');
    }
});

// Add a test endpoint to check if server is working
app.get('/test', (req, res) => {
    res.json({ message: 'PayHero server is running!', timestamp: new Date() });
});

// Add an endpoint to manually create the tests collection
app.post('/create-collection', async (req, res) => {
    try {
        await db.collection('tests').doc('init').set({
            message: 'Collection initialized',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ success: true, message: 'Tests collection created' });
    } catch (err) {
        console.error('Error creating collection:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PayHero server running on port ${PORT}`));