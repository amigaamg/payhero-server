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
        // Extract data with proper fallbacks
        const response = data.response || data;
        const statusCode = response.ResultCode ?? data.ResultCode ?? data.resultCode;
        const transCode = response.MpesaReceiptNumber ?? response.CheckoutRequestID ?? data.MpesaReceiptNumber ?? data.CheckoutRequestID ?? 'NO-CODE';
        const amount = response.Amount ?? data.Amount ?? data.amount ?? 0;
        const phone = response.Phone ?? response.MSISDN ?? data.Phone ?? data.MSISDN ?? 'UNKNOWN';
        const reference = response.ExternalReference ?? data.ExternalReference ?? data.external_reference ?? response.CheckoutRequestID ?? data.CheckoutRequestID;

        console.log('Extracted values:', {
            statusCode,
            transCode,
            amount,
            phone,
            reference
        });

        // Validate that we have a valid reference
        if (!reference || reference.trim() === '') {
            console.error('ERROR: No valid reference found in callback data');
            // Generate a fallback reference using timestamp and phone
            const fallbackRef = `FALLBACK-${Date.now()}-${phone.slice(-4)}`;
            console.log(`Using fallback reference: ${fallbackRef}`);
        }

        // Use the reference or fallback
        const documentId = (reference && reference.trim() !== '') ? reference : `FALLBACK-${Date.now()}-${phone.slice(-4)}`;

        const paymentRecord = {
            transCode,
            amount: parseFloat(amount),
            phone,
            status: statusCode === 0 ? 'success' : 'failed',
            callbackData: data,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            documentId, // Store the document ID for reference
            resultCode: statusCode,
            resultDesc: response.ResultDesc || data.ResultDesc || 'No description'
        };

        console.log(`Saving to Firebase with document ID: ${documentId}`);

        // Save in Firebase using the document ID
        await db.collection('tests').doc(documentId).set(paymentRecord, { merge: true });

        console.log(`Payment recorded successfully: ${statusCode === 0 ? 'SUCCESS' : 'FAILED'} - ${transCode}`);
        console.log(`Document saved with ID: ${documentId}`);

        res.status(200).json({
            success: true,
            message: 'Callback processed successfully',
            documentId: documentId
        });

    } catch (err) {
        console.error("Error saving payment to Firebase:", err);
        console.error("Full error details:", err.stack);
        
        // Try to save error information for debugging
        try {
            const errorRecord = {
                error: err.message,
                callbackData: data,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                errorType: 'callback_processing_error'
            };
            
            await db.collection('errors').add(errorRecord);
            console.log('Error record saved to errors collection');
        } catch (errorSaveErr) {
            console.error('Failed to save error record:', errorSaveErr);
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error processing callback'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'PayHero callback server is running'
    });
});

// Test endpoint to manually create a document (for debugging)
app.post('/test/create-doc', async (req, res) => {
    try {
        const testRef = `TEST-${Date.now()}`;
        const testDoc = {
            test: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: 'Test document creation'
        };
        
        await db.collection('tests').doc(testRef).set(testDoc);
        res.status(200).json({ 
            success: true, 
            documentId: testRef,
            message: 'Test document created successfully'
        });
    } catch (err) {
        console.error('Test document creation failed:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`PayHero server running on port ${PORT}`);
    console.log('Available endpoints:');
    console.log('- POST /payhero/callback (PayHero callback handler)');
    console.log('- GET /health (Health check)');
    console.log('- POST /test/create-doc (Test document creation)');
});