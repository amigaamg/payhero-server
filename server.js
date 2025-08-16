// server.js - Troubleshooting version with detailed auth diagnostics
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
            console.error("❌ Environment variable GOOGLE_APPLICATION_CREDENTIALS_JSON is missing!");
            process.exit(1);
        }

        console.log("🔍 Parsing service account JSON...");
        const serviceAccountRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        
        // Debug the raw environment variable (first 100 chars)
        console.log("Raw env var preview:", serviceAccountRaw.substring(0, 100) + "...");
        console.log("Raw env var length:", serviceAccountRaw.length);
        
        const serviceAccount = JSON.parse(serviceAccountRaw);
        
        // Enhanced debug info
        console.log("📋 Service Account Analysis:");
        console.log("- Type:", serviceAccount.type);
        console.log("- Project ID:", serviceAccount.project_id);
        console.log("- Client Email:", serviceAccount.client_email);
        console.log("- Private Key ID:", serviceAccount.private_key_id);
        console.log("- Client ID:", serviceAccount.client_id);
        console.log("- Universe Domain:", serviceAccount.universe_domain || "NOT SET");
        console.log("- Private Key Length:", serviceAccount.private_key ? serviceAccount.private_key.length : "MISSING");
        console.log("- Private Key Format Check:", serviceAccount.private_key ? 
            (serviceAccount.private_key.includes('BEGIN PRIVATE KEY') ? "✅ Valid" : "❌ Invalid") : "❌ Missing");
        
        // Validate all required fields
        const requiredFields = [
            'type', 'project_id', 'private_key_id', 'private_key', 
            'client_email', 'client_id', 'auth_uri', 'token_uri'
        ];
        const missingFields = requiredFields.filter(field => !serviceAccount[field]);
        
        if (missingFields.length > 0) {
            console.error("❌ Missing required fields:", missingFields);
            process.exit(1);
        } else {
            console.log("✅ All required fields present");
        }

        // Check private key format more thoroughly
        if (serviceAccount.private_key) {
            const pkLines = serviceAccount.private_key.split('\n');
            console.log("🔑 Private Key Analysis:");
            console.log("- Line count:", pkLines.length);
            console.log("- First line:", pkLines[0]);
            console.log("- Last line:", pkLines[pkLines.length - 1]);
            console.log("- Contains \\n chars:", serviceAccount.private_key.includes('\\n'));
        }

        console.log("🚀 Initializing Firebase Admin...");
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
        });

        console.log("✅ Firebase Admin initialized successfully!");

    } catch (error) {
        console.error("❌ Firebase Admin initialization failed:");
        console.error("Error type:", error.constructor.name);
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        
        if (error.message.includes('JSON')) {
            console.error("🚨 JSON PARSING ERROR - Check your environment variable format");
            console.error("First 200 chars of env var:", process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.substring(0, 200));
        }
        
        console.error("Full error:", error);
        process.exit(1);
    }
}

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Comprehensive Firebase connection test
async function testFirebaseConnection() {
    console.log("\n🧪 Starting comprehensive Firebase tests...");
    
    try {
        // Test 1: Basic Firestore instance
        console.log("Test 1: Firestore instance check...");
        console.log("✅ Firestore instance created");

        // Test 2: Simple document write with explicit project
        console.log("Test 2: Testing document write...");
        const testCollection = db.collection('connection_tests');
        const testDocRef = testCollection.doc('auth-test-' + Date.now());
        
        await testDocRef.set({
            test: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: "Authentication test",
            serverTime: new Date().toISOString()
        });
        console.log("✅ Document write successful");

        // Test 3: Read back the document
        console.log("Test 3: Testing document read...");
        const docSnapshot = await testDocRef.get();
        if (docSnapshot.exists) {
            console.log("✅ Document read successful");
            console.log("Document data:", docSnapshot.data());
        } else {
            console.log("❌ Document read failed - not found");
        }

        // Test 4: Update document
        console.log("Test 4: Testing document update...");
        await testDocRef.update({
            updated: true,
            updateTime: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Document update successful");

        // Test 5: Delete document
        console.log("Test 5: Testing document delete...");
        await testDocRef.delete();
        console.log("✅ Document delete successful");

        // Test 6: Check project access
        console.log("Test 6: Testing project access...");
        try {
            const collections = await db.listCollections();
            console.log("✅ Project access successful");
            console.log("Available collections:", collections.map(c => c.id));
        } catch (listError) {
            console.log("⚠️  Collection listing failed (might be permission issue):", listError.message);
        }

        console.log("🎉 ALL FIREBASE TESTS PASSED!");
        return true;

    } catch (error) {
        console.error("❌ Firebase connection test failed:");
        console.error("Error type:", error.constructor.name);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        if (error.code === 16 || error.code === 'UNAUTHENTICATED') {
            console.error("\n🚨 AUTHENTICATION FAILURE DETECTED!");
            console.error("Possible causes:");
            console.error("1. Service account key is invalid or corrupted");
            console.error("2. Service account doesn't have Firestore permissions");
            console.error("3. Project ID mismatch");
            console.error("4. Private key format is incorrect");
            console.error("5. Environment variable wasn't updated properly");
        }
        
        console.error("Full error details:", error);
        return false;
    }
}

// PayHero callback with enhanced error handling
app.post('/payhero/callback', async (req, res) => {
    const data = req.body;
    console.log('\n📥 PayHero Callback Received');

    try {
        // Extract payment data
        const response = data.response || data;
        const reference = response.ExternalReference || `FALLBACK-${Date.now()}`;
        
        const paymentRecord = {
            transCode: response.MpesaReceiptNumber || 'NO-CODE',
            amount: parseFloat(response.Amount || 0),
            phone: response.Phone || 'UNKNOWN',
            status: response.ResultCode === 0 ? 'success' : 'failed',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            resultCode: response.ResultCode,
            rawCallback: data
        };

        console.log(`💾 Attempting Firebase save with ID: ${reference}`);

        // Test Firebase auth before saving payment
        try {
            console.log("🔐 Testing auth with dummy write...");
            await db.collection('auth_tests').doc('test').set({
                test: true,
                time: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log("✅ Auth test passed, proceeding with payment save...");
            
            // Clean up test doc
            await db.collection('auth_tests').doc('test').delete();
            
        } catch (authTestError) {
            console.error("❌ Auth test failed:", authTestError.message);
            throw authTestError;
        }

        // Save payment record
        await db.collection('tests').doc(reference).set(paymentRecord, { merge: true });
        console.log(`✅ Payment saved successfully: ${reference}`);

        res.status(200).json({
            success: true,
            message: 'Payment processed',
            documentId: reference
        });

    } catch (err) {
        console.error("❌ Callback error:", err.message);
        console.error("Error code:", err.code);
        
        res.status(500).json({
            success: false,
            message: 'Processing failed',
            error: err.message,
            code: err.code
        });
    }
});

// Enhanced health check with auth test
app.get('/health', async (req, res) => {
    console.log('\n🏥 Health Check Started');
    
    try {
        // Test Firebase auth
        await db.collection('health_checks').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'healthy'
        });

        res.status(200).json({
            status: 'OK',
            firebase: 'connected',
            timestamp: new Date().toISOString(),
            message: 'All systems operational'
        });
        
        console.log('✅ Health check passed');

    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        
        res.status(500).json({
            status: 'ERROR',
            firebase: 'disconnected',
            error: error.message,
            code: error.code,
            timestamp: new Date().toISOString()
        });
    }
});

// Debug endpoint to check environment variable
app.get('/debug/env', (req, res) => {
    try {
        const hasEnvVar = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        const envVarLength = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length || 0;
        const envVarPreview = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.substring(0, 100) || 'NOT SET';
        
        let parsedOk = false;
        let serviceAccount = null;
        
        try {
            serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}');
            parsedOk = true;
        } catch (parseError) {
            parsedOk = false;
        }

        res.json({
            hasEnvironmentVariable: hasEnvVar,
            environmentVariableLength: envVarLength,
            environmentVariablePreview: envVarPreview,
            jsonParseSuccess: parsedOk,
            projectId: serviceAccount?.project_id || 'PARSE_FAILED',
            clientEmail: serviceAccount?.client_email || 'PARSE_FAILED',
            hasPrivateKey: !!(serviceAccount?.private_key),
            privateKeyLength: serviceAccount?.private_key?.length || 0
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Debug check failed',
            message: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;

// Start server with comprehensive testing
console.log('🚀 Starting PayHero Server with Enhanced Diagnostics...\n');

testFirebaseConnection().then((success) => {
    if (success) {
        app.listen(PORT, () => {
            console.log(`\n🎯 Server successfully started on port ${PORT}`);
            console.log('🔗 Test endpoints:');
            console.log(`- Health: https://payhero-server.onrender.com/health`);
            console.log(`- Debug:  https://payhero-server.onrender.com/debug/env`);
            console.log('\n✅ Server ready for PayHero callbacks!');
        });
    } else {
        console.log('\n⚠️  Starting server despite Firebase issues (for debugging)...');
        app.listen(PORT, () => {
            console.log(`\n🔧 Server running on port ${PORT} (Firebase auth failed)`);
            console.log('🔗 Debug endpoints available for troubleshooting');
        });
    }
}).catch((error) => {
    console.error('❌ Server startup error:', error);
    process.exit(1);
});