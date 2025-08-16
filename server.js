// server.js - Debug version to identify auth issues
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
            process.exit(1);
        }

        console.log("Parsing service account JSON...");
        const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        
        // Debug service account details (without sensitive info)
        console.log("Service Account Debug Info:");
        console.log("- Type:", serviceAccount.type);
        console.log("- Project ID:", serviceAccount.project_id);
        console.log("- Client Email:", serviceAccount.client_email);
        console.log("- Private Key ID:", serviceAccount.private_key_id);
        console.log("- Private Key exists:", !!serviceAccount.private_key);
        console.log("- Private Key starts with:", serviceAccount.private_key ? serviceAccount.private_key.substring(0, 50) + "..." : "MISSING");
        
        // Validate required fields
        const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri'];
        const missingFields = requiredFields.filter(field => !serviceAccount[field]);
        
        if (missingFields.length > 0) {
            console.error("Missing required fields in service account:", missingFields);
            process.exit(1);
        }

        // Check if private key is properly formatted
        if (!serviceAccount.private_key.includes('BEGIN PRIVATE KEY')) {
            console.error("Private key appears to be malformed - missing BEGIN PRIVATE KEY header");
            console.log("Private key preview:", serviceAccount.private_key.substring(0, 100));
        }

        console.log("Initializing Firebase Admin...");
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
        });

        console.log("✅ Firebase Admin initialized successfully!");

    } catch (error) {
        console.error("❌ Error initializing Firebase Admin:");
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Full error:", error);
        
        if (error.message.includes('JSON')) {
            console.error("This looks like a JSON parsing error. Check your GOOGLE_APPLICATION_CREDENTIALS_JSON format.");
        }
        
        process.exit(1);
    }
}

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Enhanced test Firebase connection
async function testFirebaseConnection() {
    try {
        console.log("\n🔍 Testing Firebase connection...");
        
        // Test 1: Simple document write
        console.log("Test 1: Creating test document...");
        const testDocRef = db.collection('connection_tests').doc('test-' + Date.now());
        await testDocRef.set({
            test: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: "Connection test from server"
        });
        console.log("✅ Test 1 passed: Document created successfully");

        // Test 2: Read the document back
        console.log("Test 2: Reading test document...");
        const doc = await testDocRef.get();
        if (doc.exists) {
            console.log("✅ Test 2 passed: Document read successfully");
            console.log("Document data:", doc.data());
        } else {
            console.log("❌ Test 2 failed: Document not found");
        }

        // Test 3: Delete the document
        console.log("Test 3: Deleting test document...");
        await testDocRef.delete();
        console.log("✅ Test 3 passed: Document deleted successfully");

        // Test 4: List collections (to test read permissions)
        console.log("Test 4: Testing collection access...");
        const collections = await db.listCollections();
        console.log("✅ Test 4 passed: Can access collections");
        console.log("Available collections:", collections.map(col => col.id));

        console.log("🎉 All Firebase connection tests passed!");
        
    } catch (error) {
        console.error("❌ Firebase connection test failed:");
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Error details:", error.details);
        
        // Specific error handling
        if (error.code === 16) {
            console.error("\n🚨 AUTHENTICATION ERROR DETECTED:");
            console.error("This means your service account credentials are invalid or expired.");
            console.error("Solutions:");
            console.error("1. Generate a new service account key from Firebase Console");
            console.error("2. Make sure the service account has Firestore permissions");
            console.error("3. Check that the private key is not corrupted");
        }
        
        if (error.message.includes('PERMISSION_DENIED')) {
            console.error("\n🚨 PERMISSION ERROR DETECTED:");
            console.error("Your service account doesn't have permission to access Firestore");
            console.error("Solutions:");
            console.error("1. Go to IAM & Admin in Google Cloud Console");
            console.error("2. Find your service account and add 'Cloud Datastore User' role");
            console.error("3. Or add 'Firebase Admin SDK Administrator Service Agent' role");
        }
    }
}

// PayHero callback endpoint - simplified for debugging
app.post('/payhero/callback', async (req, res) => {
    const data = req.body;
    console.log('\n📥 Incoming PayHero Callback:', JSON.stringify(data, null, 2));

    try {
        // Extract data
        const response = data.response || data;
        const statusCode = response.ResultCode ?? data.ResultCode ?? data.resultCode;
        const transCode = response.MpesaReceiptNumber ?? 'NO-CODE';
        const amount = response.Amount ?? data.Amount ?? 0;
        const phone = response.Phone ?? data.Phone ?? 'UNKNOWN';
        const reference = response.ExternalReference ?? data.ExternalReference ?? `FALLBACK-${Date.now()}`;

        console.log('📋 Extracted payment data:', {
            statusCode, transCode, amount, phone, reference
        });

        // Create payment record
        const paymentRecord = {
            transCode,
            amount: parseFloat(amount),
            phone,
            status: statusCode === 0 ? 'success' : 'failed',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            resultCode: statusCode,
            resultDesc: response.ResultDesc || 'No description',
            rawCallback: data
        };

        console.log(`💾 Saving to Firebase collection 'tests' with ID: ${reference}`);

        // Save to Firebase with detailed error handling
        try {
            await db.collection('tests').doc(reference).set(paymentRecord, { merge: true });
            console.log(`✅ Payment saved successfully!`);
            
            // Verify save
            const savedDoc = await db.collection('tests').doc(reference).get();
            if (savedDoc.exists) {
                console.log(`✅ Verification passed - document exists in Firebase`);
            } else {
                console.log(`❌ Verification failed - document not found after save`);
            }
            
        } catch (saveError) {
            console.error(`❌ Firebase save error:`, saveError.message);
            console.error('Error code:', saveError.code);
            console.error('Error details:', saveError.details);
            throw saveError;
        }

        res.status(200).json({
            success: true,
            message: 'Payment processed successfully',
            documentId: reference,
            status: statusCode === 0 ? 'success' : 'failed'
        });

    } catch (err) {
        console.error("❌ Callback processing error:", err.message);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
});

// Enhanced health check
app.get('/health', async (req, res) => {
    console.log('\n🏥 Health check requested...');
    
    try {
        // Test Firebase connection
        const testDoc = await db.collection('health_checks').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'healthy'
        });
        
        console.log('✅ Health check: Firebase connection working');
        
        res.status(200).json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            message: 'Server and Firebase both healthy',
            firebase: 'connected',
            testDocId: testDoc.id
        });
        
    } catch (error) {
        console.error('❌ Health check: Firebase connection failed:', error.message);
        
        res.status(500).json({ 
            status: 'ERROR', 
            timestamp: new Date().toISOString(),
            message: 'Server running but Firebase failed',
            firebase: 'disconnected',
            error: error.message
        });
    }
});

// Service account debug endpoint
app.get('/debug/auth', (req, res) => {
    try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        
        res.json({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKeyId: serviceAccount.private_key_id,
            hasPrivateKey: !!serviceAccount.private_key,
            privateKeyPreview: serviceAccount.private_key ? 
                serviceAccount.private_key.substring(0, 50) + "..." : "MISSING"
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to parse service account",
            message: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;

// Start server with connection test
console.log('🚀 Starting PayHero Callback Server...');
testFirebaseConnection().then(() => {
    app.listen(PORT, () => {
        console.log(`\n✅ Server running on port ${PORT}`);
        console.log('📍 Available endpoints:');
        console.log('- POST /payhero/callback');
        console.log('- GET /health');
        console.log('- GET /debug/auth');
        console.log('\n🎯 Server ready for PayHero callbacks!');
    });
}).catch((error) => {
    console.error("\n❌ Server startup failed:", error.message);
    
    // Still start the server even if Firebase fails (for debugging)
    app.listen(PORT, () => {
        console.log(`\n⚠️  Server running on port ${PORT} (Firebase connection failed)`);
        console.log('🔧 Use /debug/auth and /health endpoints to troubleshoot');
    });
});