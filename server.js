const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // local only
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/payhero/callback', async (req, res) => {
  const data = req.body;
  console.log('PayHero Callback:', data);

  if (data.ResultCode === 0) {
    const transCode = data.MpesaReceiptNumber || data.CheckoutRequestID;
    const amount = data.Amount;
    const phone = data.MSISDN;

    await db.collection('payments').add({
      transCode,
      amount,
      phone,
      status: 'success',
      timestamp: new Date()
    });
  } else {
    await db.collection('payments').add({
      status: 'failed',
      data,
      timestamp: new Date()
    });
  }

  res.status(200).send('Received');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PayHero server running on port ${PORT}`));
