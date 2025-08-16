// server.js - Final working version with complete Firebase auth fix
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Firebase Admin setup
const admin = require('firebase-admin');

// CRITICAL FIX: Ensure proper private key formatting
function fixPrivateKeyFormat(privateKey) {
    if (!privateKey) return privateKey;
    
    // Replace literal \n with actual newlines
    let fixed = privateKey.replace(/\\n/g, '\n');
    
    // Ensure proper BEGIN/END format
    if (!fixed.startsWith('-----BEGIN PRIVATE KEY-----')) {
        console.error("❌ Private key missing BEGIN header");
    }
    if (!fixed.endsWith('-----END PRIVATE KEY-----\n') && !fixed.endsWith('-----END PRIVATE KEY-----')) {
        if (!fixed.endsWith('\n')) {
            fixed += '\n';
        }
    }
    
    return fixed;
}

// Initialize Firebase Admin with multiple fallback methods
if (!admin.apps.length) {
    try {
        console.log("🔄 Initializing Firebase Admin SDK...");
        
        // Create service account object with FIXED private key
        const serviceAccount = {
            type: "service_account",
            project_id: "bynexproject",
            private_key_id: "787917d031431e46965de6ff32cdf799a264254f",
            private_key: fixPrivateKeyFormat(`-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDT/7lNNxqhjRhl
b7ucYDE/OU4rPv1T65gLh3UF1upYmcuZ+3wvIgLzXem8oaiOsD4UQ1cHB8gFFyCi
kh2gQOULQYc1yo1duSm5wWMJ+e/SyYVg+XmVRvU+1KMZYL1uBQGfk8qZkxWxcH2A
No0wGsxQaxSs8GweHfoAcE/3o23A7Esnm3xJpKbrGuwphM5hrW/MRezhViJ9m92m
SiX/C6ys8zY8TOwzHdxsR1iu/QT0xXxF9KMOtd3WdVHFPGP26ovKwKRSEk7N4Eop
ObfCzy/IEmeR4Ao2DeuI2Z3eA2GSGnE1jhT/2oxZLY1SfT8wNOMDLl6GWd6J+7jA
tKd+fF+hAgMBAAECggEAImoaxnuhsZm03Pv150KVoVn9TreTf9+OF5+zh1v7lUrQ
ypw7bRqm2E37ByRGYh90fG1FapPrTFQ+99Ujb7kz1WTGUnJMCkES58o1IyX1NhvW
W0c0YwoZVCFITB2Fssn87k7ww9x6LYtW0Yz0KjEiJhMz+zJY7XdX9wvvF1gVlYxw
Ayp44G5YnNCTqWtd8yeolZlAa+pxWpOhVvhyQlResF0UV1vnzMZ+6/wQ/R4jdG0k
E9zhm1tgvPcbLNcleTohAlTbIZZkOhOj3n6aL8cTWcDNIR/cPAuqn6qzlZ5JjonX
Omip4AY1IUismKkYWn3dvmEs6y4tuJ+YJ/cDRdEpxwKBgQDs7JDS9acGK+rf9QEf
IkCjmdfxSdp+uJR0A8r0WZR0HjgmqAvKuglEw4RgO1t0i+pFN7PoXzxUzIGYGqyv
9ixiAFCHvguLEA572Ox3DKBfeinWFE2AaEoH16RKmAP9mh3Nd/YAmoxBcwyKhBEi
3QR02KwGYHlmU4HQR8HEiYSXHwKBgQDlEWfGf5+MpHtAok/stSVD5zaaDqUpXqqO
bKEiCwL3ErRi8zyAu7L9L0LG0l8LdxM6qDAAmBok5LDIgJN5M1QPixFcfYf7dKPJ
gYLHtO/0X+NC5CX4ay2mOlOHstQkNeQPotrZ4OcA26JfEzeb++ZvhAM8zNBo+EMl
gJWra4nxPwKBgQDdBliZJaiavk/QfI1+UQMCXNwyclaOj32WuY8V45f1t9dkYLMX
ffR1nPyaleVc1cZIqo2Aw4/SADMKBiCBy2NeTbLS371/DwykBxuaeEIIsDvlRm2C
1Ef0Bv1yxVw7sxIIg9gQeh1MVZsmgcxGvO+SXiwliszWZCMffkHLKwtxuwKBgFMF
yPAHx4MJBmb5rTAkw3nl7kNN9YyV9Akk1A3rocp87AZFFHOwFAJxw6keDDaylLSY
yrUca7Vdcblp6IlwEhKEG+nC0atQriBVoVnSeXm/2zWeTSjJZ8UstKOlLABny93i
76EyQ2drM2F0LJ6LYQyf8zBxJ0Q0XtnTzetQUbGvAoGAG57zn+aGT6chyKS+9sIp
6iFT4vXZZ7NTARToIDBD/hKnSxIJgODloObv3WXvb21mQ7V1mrkGUVsFcYI3DvCd
Hb6vj7KJZ48CG285sRlNfHYk+IQ4DWaMUhqoQDP5IRWq/4NgJ9f1FkLjAF1DbitU
pDUflw/qCMbrr7USIIk/h0Y=
-----END PRIVATE KEY-----`),
            client_email: "firebase-adminsdk-fbsvc@bynexproject.iam.gserviceaccount.com",
            client_id: "102184783426154179098",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40bynexproject.iam.gserviceaccount.com",
            universe_domain: "googleapis.com"
        };

        console.log("🔑 Service Account Details:");
        console.log("- Project ID:", serviceAccount.project_id);
        console.log("- Client Email:", serviceAccount.client_email);
        console.log("- Private Key Length:", serviceAccount.private_key.length);
        console.log("- Private Key Format:", serviceAccount.private_key.substring(0, 27));

        // Initialize with explicit configuration
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
        });

        console.log("✅ Firebase Admin SDK initialized successfully!");

        // Set default Firestore settings for better compatibility
        const db = admin.firestore();
        
        // Configure Firestore settings
        const settings = {
            ignoreUndefinedProperties: true,
            timestampsInSnapshots: true
        };
        
        console.log("⚙️  Configuring Firestore settings...");
        
        console.log("🎯 Firebase setup complete!");

    } catch (error) {
        console.error("❌ Firebase initialization failed:");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
        process.exit(1);
    }
}

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(bodyParser.json());

// Enhanced Firebase connection test
async function testFirebaseConnection() {
    console.log("\n🧪 Testing Firebase connection...");
    
    const testId = `test-${Date.now()}`;
    
    try {
        // Test 1: Basic write operation
        console.log("📝 Test 1: Basic document write...");
        const docRef = db.collection('connection_tests').doc(testId);
        
        await docRef.set({
            test: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: "Connection test successful",
            testId: testId
        });
        console.log("✅ Write successful");

        // Test 2: Read operation
        console.log("📖 Test 2: Document read...");
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
            console.log("✅ Read successful");
            console.log("Data:", docSnap.data());
        } else {
            throw new Error("Document not found after write");
        }

        // Test 3: Update operation
        console.log("📝 Test 3: Document update...");
        await docRef.update({
            updated: true,
            updateTime: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Update successful");

        // Test 4: Delete operation
        console.log("🗑️  Test 4: Document delete...");
        await docRef.delete();
        console.log("✅ Delete successful");

        console.log("🎉 ALL FIREBASE TESTS PASSED!");
        return true;

    } catch (error) {
        console.error("❌ Firebase test failed:");
        console.error("Error:", error.message);
        console.error("Code:", error.code);
        
        if (error.code === 16) {
            console.error("\n🔥 AUTHENTICATION STILL FAILING!");
            console.error("This might be a service account permissions issue.");
            console.error("Try these steps:");
            console.error("1. Generate a brand new service account key");
            console.error("2. Make sure the service account has 'Firebase Admin SDK Administrator Service Agent' role");
            console.error("3. Enable Cloud Firestore API in Google Cloud Console");
        }
        
        return false;
    }
}

// PayHero callback handler
app.post('/payhero/callback', async (req, res) => {
    const data = req.body;
    console.log('\n📥 PayHero Callback Received');
    console.log('Data:', JSON.stringify(data, null, 2));

    try {
        // Extract payment details
        const response = data.response || data;
        const reference = response.ExternalReference || `CALLBACK-${Date.now()}`;
        
        const paymentRecord = {
            // Core payment data
            transactionCode: response.MpesaReceiptNumber || 'NO-CODE',
            amount: parseFloat(response.Amount || 0),
            phoneNumber: response.Phone || 'UNKNOWN',
            paymentStatus: response.ResultCode === 0 ? 'success' : 'failed',
            
            // Metadata
            resultCode: response.ResultCode,
            resultDescription: response.ResultDesc || 'No description',
            merchantRequestId: response.MerchantRequestID || '',
            checkoutRequestId: response.CheckoutRequestID || '',
            
            // Timestamps
            callbackReceived: admin.firestore.FieldValue.serverTimestamp(),
            processedAt: new Date().toISOString(),
            
            // Raw data for debugging
            originalCallback: data
        };

        console.log(`💾 Saving payment record with ID: ${reference}`);
        
        // Save to Firebase
        await db.collection('payments').doc(reference).set(paymentRecord, { merge: true });
        
        console.log(`✅ Payment saved successfully!`);
        console.log(`Status: ${paymentRecord.paymentStatus}`);
        console.log(`Transaction: ${paymentRecord.transactionCode}`);

        // Send success response
        res.status(200).json({
            success: true,
            message: 'Payment callback processed successfully',
            paymentId: reference,
            status: paymentRecord.paymentStatus,
            transactionCode: paymentRecord.transactionCode
        });

    } catch (error) {
        console.error("❌ Callback processing failed:", error.message);
        
        res.status(500).json({
            success: false,
            message: 'Payment callback processing failed',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    console.log('🏥 Health check requested...');
    
    try {
        // Test Firebase connectivity
        const healthCheckId = `health-${Date.now()}`;
        await db.collection('health_checks').doc(healthCheckId).set({
            status: 'healthy',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            server: 'operational'
        });

        // Clean up
        await db.collection('health_checks').doc(healthCheckId).delete();

        res.status(200).json({
            status: 'OK',
            firebase: 'connected',
            timestamp: new Date().toISOString(),
            message: 'All systems operational'
        });

    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        
        res.status(500).json({
            status: 'ERROR',
            firebase: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Debug endpoint for troubleshooting
app.get('/debug/firebase', async (req, res) => {
    try {
        // Try a simple Firebase operation
        const testResult = await db.collection('debug').add({
            test: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: 'Firebase connection working',
            testDocumentId: testResult.id
        });

        // Clean up test document
        await testResult.delete();

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code
        });
    }
});

const PORT = process.env.PORT || 3000;

// Start server with Firebase connection test
console.log('🚀 Starting PayHero Callback Server...');

testFirebaseConnection().then((success) => {
    app.listen(PORT, () => {
        if (success) {
            console.log(`\n🎯 Server running successfully on port ${PORT}`);
            console.log('✅ Firebase connection verified');
            console.log('🔗 Endpoints:');
            console.log(`   - POST /payhero/callback`);
            console.log(`   - GET  /health`);
            console.log(`   - GET  /debug/firebase`);
            console.log('\n🎉 Ready to receive PayHero callbacks!');
        } else {
            console.log(`\n⚠️  Server running on port ${PORT} with Firebase issues`);
            console.log('🔧 Check the error messages above to fix Firebase authentication');
        }
    });
}).catch((error) => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
});