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
        const statusCode = data.ResultCode ?? data.resultCode ?? 1;
        const transCode = (data.MpesaReceiptNumber ?? data.CheckoutRequestID ?? `NO-CODE-${Date.now()}`).toString();
        const amount = Number(data.Amount ?? data.amount ?? 0);
        const phone = (data.MSISDN ?? data.Phone ?? 'UNKNOWN').toString();
        const reference = (data.ExternalReference ?? data.external_reference ?? data.CheckoutRequestID ?? `auto-${Date.now()}`).toString();

        const paymentRecord = {
            transCode,
            amount,
            phone,
            status: statusCode === 0 ? 'success' : 'failed',
            callbackData: data,
            timestamp: new Date()
        };

        // Save in Firestore collection 'tests'
        await db.collection('tests').doc(reference).set(paymentRecord, { merge: true });

        console.log(`Payment recorded: ${statusCode === 0 ? 'SUCCESS' : 'FAILED'} - ${transCode}`);

        res.status(200).send('Received');
    } catch (err) {
        console.error("Error saving payment to Firebase:", err);
        res.status(500).send('Server error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PayHero server running on port ${PORT}`));
