// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Firebase Admin setup using environment variable
const admin = require('firebase-admin');

// Check if Firebase Admin is already initialized
if (!admin.apps.length) {
    try {
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            console.error("ERROR: Environment variable GOOGLE_APPLICATION_CREDENTIALS_JSON is missing!");
            console.log("Available environment variables:", Object.keys(process.env).filter(key => key.includes('GOOGLE') || key.includes('FIREBASE')));
            process.exit(1);
        }

        console.log("Initializing Firebase Admin...");
        const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        
        // Validate required fields in service account
        const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri'];
        const missingFields = requiredFields.filter(field => !serviceAccount[field]);
        
        if (missingFields.length > 0) {
            console.error("Missing required fields in service account:", missingFields);
            process.exit(1);
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
        });

        console.log("Firebase Admin initialized successfully!");
        console.log("Project ID:", serviceAccount.project_id);
        console.log("Service Account Email:", serviceAccount.client_email);

    } catch (error) {
        console.error("Error initializing Firebase Admin:", error.message);
        console.error("Full error:", error);
        process.exit(1);
    }
} else {
    console.log("Firebase Admin already initialized");
}

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Test Firebase connection on startup
async function testFirebaseConnection() {
    try {
        console.log("Testing Firebase connection...");
        const testDoc = {
            test: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: "Server startup test"
        };
        
        const docRef = await db.collection('server_tests').add(testDoc);
        console.log("✅ Firebase connection successful! Test document ID:", docRef.id);
        
        // Clean up test document
        await docRef.delete();
        console.log("Test document cleaned up");
        
    } catch (error) {
        console.error("❌ Firebase connection failed:", error.message);
        console.error("Full error:", error);
    }
}

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
            documentId,
            resultCode: statusCode,
            resultDesc: response.ResultDesc || data.ResultDesc || 'No description',
            processedAt: new Date().toISOString(),
            merchantRequestId: response.MerchantRequestID || data.MerchantRequestID,
            checkoutRequestId: response.CheckoutRequestID || data.CheckoutRequestID
        };

        console.log(`Attempting to save to Firebase with document ID: ${documentId}`);

        // Test Firebase connection before saving
        try {
            await db.collection('tests').doc('connection_test').set({
                test: true,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log("Firebase connection test passed");
            
            // Delete test document
            await db.collection('tests').doc('connection_test').delete();
        } catch (testError) {
            console.error("Firebase connection test failed:", testError.message);
            throw new Error(`Firebase connection failed: ${testError.message}`);
        }

        // Save the actual payment record
        await db.collection('tests').doc(documentId).set(paymentRecord, { merge: true });

        console.log(`✅ Payment recorded successfully: ${statusCode === 0 ? 'SUCCESS' : 'FAILED'} - ${transCode}`);
        console.log(`Document saved with ID: ${documentId}`);

        // Verify the document was saved
        const savedDoc = await db.collection('tests').doc(documentId).get();
        if (savedDoc.exists) {
            console.log("✅ Document verification successful");
            console.log("Saved data:", JSON.stringify(savedDoc.data(), null, 2));
        } else {
            console.error("❌ Document verification failed - document not found after save");
        }

        res.status(200).json({
            success: true,
            message: 'Callback processed successfully',
            documentId: documentId,
            status: statusCode === 0 ? 'success' : 'failed'
        });

    } catch (err) {
        console.error("❌ Error saving payment to Firebase:", err.message);
        console.error("Full error details:", err.stack);
        
        // Try to save error information for debugging
        try {
            const errorRecord = {
                error: err.message,
                errorStack: err.stack,
                callbackData: data,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                errorType: 'callback_processing_error'
            };
            
            await db.collection('errors').add(errorRecord);
            console.log('Error record saved to errors collection');
        } catch (errorSaveErr) {
            console.error('Failed to save error record:', errorSaveErr.message);
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error processing callback',
            error: err.message
        });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Test Firebase connection
        await db.collection('health_checks').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'healthy'
        });

        res.status(200).json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            message: 'PayHero callback server is running',
            firebase: 'connected'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            timestamp: new Date().toISOString(),
            message: 'Server running but Firebase connection failed',
            error: error.message,
            firebase: 'disconnected'
        });
    }
});

// Test endpoint to manually create a document (for debugging)
app.post('/test/create-doc', async (req, res) => {
    try {
        const testRef = `TEST-${Date.now()}`;
        const testDoc = {
            test: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: 'Test document creation',
            createdFrom: 'manual_test_endpoint'
        };
        
        await db.collection('tests').doc(testRef).set(testDoc);
        
        // Verify the document was created
        const createdDoc = await db.collection('tests').doc(testRef).get();
        
        res.status(200).json({ 
            success: true, 
            documentId: testRef,
            message: 'Test document created successfully',
            verified: createdDoc.exists,
            data: createdDoc.exists ? createdDoc.data() : null
        });
    } catch (err) {
        console.error('Test document creation failed:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message,
            stack: err.stack
        });
    }
});

const PORT = process.env.PORT || 3000;

// Test Firebase connection on startup
testFirebaseConnection().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 PayHero server running on port ${PORT}`);
        console.log('Available endpoints:');
        console.log('- POST /payhero/callback (PayHero callback handler)');
        console.log('- GET /health (Health check)');
        console.log('- POST /test/create-doc (Test document creation)');
        console.log('🔥 Server ready to receive callbacks!');
    });
}).catch((error) => {
    console.error("Failed to start server due to Firebase connection error:", error);
    process.exit(1);
});