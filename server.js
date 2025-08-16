// server.js - Alternative auth method using Base64 encoding
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Firebase Admin setup using Base64 encoded service account
const admin = require('firebase-admin');

// Check if Firebase Admin is already initialized
if (!admin.apps.length) {
    try {
        // Method 1: Try direct JSON parsing
        let serviceAccount = null;
        
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            console.log("🔄 Method 1: Trying direct JSON parsing...");
            try {
                serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
                console.log("✅ Method 1 successful");
            } catch (jsonError) {
                console.log("❌ Method 1 failed:", jsonError.message);
            }
        }
        
        // Method 2: Try Base64 decoding (fallback)
        if (!serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
            console.log("🔄 Method 2: Trying Base64 decoding...");
            try {
                const decoded = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf-8');
                serviceAccount = JSON.parse(decoded);
                console.log("✅ Method 2 successful");
            } catch (base64Error) {
                console.log("❌ Method 2 failed:", base64Error.message);
            }
        }
        
        // Method 3: Hardcoded for testing (TEMPORARY - REMOVE IN PRODUCTION)
        if (!serviceAccount) {
            console.log("🔄 Method 3: Using hardcoded service account for testing...");
            serviceAccount = {
                "type": "service_account",
                "project_id": "bynexproject",
                "private_key_id": "787917d031431e46965de6ff32cdf799a264254f",
                "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDT/7lNNxqhjRhl\nb7ucYDE/OU4rPv1T65gLh3UF1upYmcuZ+3wvIgLzXem8oaiOsD4UQ1cHB8gFFyCi\nkh2gQOULQYc1yo1duSm5wWMJ+e/SyYVg+XmVRvU+1KMZYL1uBQGfk8qZkxWxcH2A\nNo0wGsxQaxSs8GweHfoAcE/3o23A7Esnm3xJpKbrGuwphM5hrW/MRezhViJ9m92m\nSiX/C6ys8zY8TOwzHdxsR1iu/QT0xXxF9KMOtd3WdVHFPGP26ovKwKRSEk7N4Eop\nObfCzy/IEmeR4Ao2DeuI2Z3eA2GSGnE1jhT/2oxZLY1SfT8wNOMDLl6GWd6J+7jA\ntKd+fF+hAgMBAAECggEAImoaxnuhsZm03Pv150KVoVn9TreTf9+OF5+zh1v7lUrQ\nypw7bRqm2E37ByRGYh90fG1FapPrTFQ+99Ujb7kz1WTGUnJMCkES58o1IyX1NhvW\nW0c0YwoZVCFITB2Fssn87k7ww9x6LYtW0Yz0KjEiJhMz+zJY7XdX9wvvF1gVlYxw\nAyp44G5YnNCTqWtd8yeolZlAa+pxWpOhVvhyQlResF0UV1vnzMZ+6/wQ/R4jdG0k\nE9zhm1tgvPcbLNcleTohAlTbIZZkOhOj3n6aL8cTWcDNIR/cPAuqn6qzlZ5JjonX\nOmip4AY1IUismKkYWn3dvmEs6y4tuJ+YJ/cDRdEpxwKBgQDs7JDS9acGK+rf9QEf\nIkCjmdfxSdp+uJR0A8r0WZR0HjgmqAvKuglEw4RgO1t0i+pFN7PoXzxUzIGYGqyv\n9ixiAFCHvguLEA572Ox3DKBfeinWFE2AaEoH16RKmAP9mh3Nd/YAmoxBcwyKhBEi\n3QR02KwGYHlmU4HQR8HEiYSXHwKBgQDlEWfGf5+MpHtAok/stSVD5zaaDqUpXqqO\nbKEiCwL3ErRi8zyAu7L9L0LG0l8LdxM6qDAAmBok5LDIgJN5M1QPixFcfYf7dKPJ\ngYLHtO/0X+NC5CX4ay2mOlOHstQkNeQPotrZ4OcA26JfEzeb++ZvhAM8zNBo+EMl\ngJWra4nxPwKBgQDdBliZJaiavk/QfI1+UQMCXNwyclaOj32WuY8V45f1t9dkYLMX\nffR1nPyaleVc1cZIqo2Aw4/SADMKBiCBy2NeTbLS371/DwykBxuaeEIIsDvlRm2C\n1Ef0Bv1yxVw7sxIIg9gQeh1MVZsmgcxGvO+SXiwliszWZCMffkHLKwtxuwKBgFMF\nyPAHx4MJBmb5rTAkw3nl7kNN9YyV9Akk1A3rocp87AZFFHOwFAJxw6keDDaylLSY\nyrUca7Vdcblp6IlwEhKEG+nC0atQriBVoVnSeXm/2zWeTSjJZ8UstKOlLABny93i\n76EyQ2drM2F0LJ6LYQyf8zBxJ0Q0XtnTzetQUbGvAoGAG57zn+aGT6chyKS+9sIp\n6iFT4vXZZ7NTARToIDBD/hKnSxIJgODloObv3WXvb21mQ7V1mrkGUVsFcYI3DvCd\nHb6vj7KJZ48CG285sRlNfHYk+IQ4DWaMUhqoQDP5IRWq/4NgJ9f1FkLjAF1DbitU\npDUflw/qCMbrr7USIIk/h0Y=\n-----END PRIVATE KEY-----\n",
                "client_email": "firebase-adminsdk-fbsvc@bynexproject.iam.gserviceaccount.com",
                "client_id": "102184783426154179098",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40bynexproject.iam.gserviceaccount.com",
                "universe_domain": "googleapis.com"
            };
            console.log("✅ Method 3 loaded hardcoded service account");
        }

        if (!serviceAccount) {
            console.error("❌ No service account available - all methods failed");
            console.error("Available environment variables:", Object.keys(process.env).filter(key => key.includes('GOOGLE')));
            process.exit(1);
        }

        console.log("📋 Using service account:");
        console.log("- Project ID:", serviceAccount.project_id);
        console.log("- Client Email:", serviceAccount.client_email);

        console.log("🚀 Initializing Firebase Admin...");
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
        });

        console.log("✅ Firebase Admin initialized successfully!");

    } catch (error) {
        console.error("❌ Firebase Admin initialization failed:", error.message);
        process.exit(1);
    }
}

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Test Firebase connection
async function testFirebaseConnection() {
    console.log("\n🧪 Testing Firebase connection...");
    
    try {
        const testDoc = await db.collection('connection_tests').add({
            test: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: "Connection test successful"
        });
        
        console.log("✅ Firebase connection successful!");
        console.log("Test document ID:", testDoc.id);
        
        // Clean up
        await testDoc.delete();
        console.log("✅ Test cleanup completed");
        
        return true;
        
    } catch (error) {
        console.error("❌ Firebase connection failed:", error.message);
        console.error("Error code:", error.code);
        return false;
    }
}

// PayHero callback
app.post('/payhero/callback', async (req, res) => {
    const data = req.body;
    console.log('\n📥 PayHero Callback:', JSON.stringify(data, null, 2));

    try {
        const response = data.response || data;
        const reference = response.ExternalReference || `FALLBACK-${Date.now()}`;
        
        const paymentRecord = {
            transCode: response.MpesaReceiptNumber || 'NO-CODE',
            amount: parseFloat(response.Amount || 0),
            phone: response.Phone || 'UNKNOWN',
            status: response.ResultCode === 0 ? 'success' : 'failed',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            resultCode: response.ResultCode,
            resultDesc: response.ResultDesc || 'No description',
            rawCallback: data
        };

        console.log(`💾 Saving to Firebase: ${reference}`);
        await db.collection('tests').doc(reference).set(paymentRecord, { merge: true });
        console.log(`✅ Payment saved successfully!`);

        res.status(200).json({
            success: true,
            message: 'Payment processed successfully',
            documentId: reference,
            status: paymentRecord.status
        });

    } catch (err) {
        console.error("❌ Callback error:", err.message);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Health check
app.get('/health', async (req, res) => {
    try {
        await db.collection('health_checks').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: 'healthy'
        });

        res.status(200).json({
            status: 'OK',
            firebase: 'connected',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            firebase: 'disconnected',
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;

testFirebaseConnection().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🎯 Server running on port ${PORT}`);
        console.log('✅ Ready for PayHero callbacks!');
    });
}).catch(() => {
    app.listen(PORT, () => {
        console.log(`\n⚠️  Server running on port ${PORT} (Firebase issues)`);
    });
});