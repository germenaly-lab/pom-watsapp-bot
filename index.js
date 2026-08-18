const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Credentials & Configuration
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pom_bot_123';
const WHATSAPP_ACCESS_TOKEN =
  process.env.WHATSAPP_ACCESS_TOKEN ||
  'EAAPfesgk6VcBSfCDqjP0IoryIhgD6cwtseTn9J6L3w3FZAghmZCeJyAQtXyHJ7gm3u8k8hLQc8ZCTFiK4zhWGDO0ptWxRmZCx3684O5VqQAg27ZAxXqycoiin7EqjcIGbagLhXnjlVb31oK6D2GH3jxBLRvByDeoPJSDYb3TPVAmZBTMvkmGpy4xT2MY8epIZBd1SzC1tAEXEL2OuuLdJJ5XrR2F2pLkUAFQ3OAsAB8v9g3SwgZC98g89ewZAShmgaOUALRnZCNO4KCQJljRuzquPL';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '1241605315706516';
const PORT = process.env.PORT || 3000;

// Auto-reply Arabic message
const AUTO_REPLY_MESSAGE =
  'أهلاً بك في وكالة باور أوف ميديا! كراً لتواصلك معنا، سنسعد بخدمتك قريباً.';

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Power of Media WhatsApp Webhook is live and healthy!');
});

// GET /webhook: Meta Webhook Verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED successfully with Meta.');
      return res.status(200).send(challenge);
    } else {
      console.warn('Webhook verification failed: token mismatch.');
      return res.sendStatus(403);
    }
  }

  return res.sendStatus(400);
});

// POST /webhook: Handle incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Verify that this is a WhatsApp API payload
  if (body.object === 'whatsapp_business_account') {
    // Acknowledge receipt to Meta immediately (prevents duplicate retries)
    res.status(200).send('EVENT_RECEIVED');

    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages;

      if (messages && messages.length > 0) {
        const message = messages[0];
        const from = message.from; // Customer's WhatsApp phone number

        console.log(`Received WhatsApp message from ${from}:`, message.text ? message.text.body : message.type);

        // Send auto-reply via Meta Graph API v25.0
        const graphUrl = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;

        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: from,
          type: 'text',
          text: {
            preview_url: false,
            body: AUTO_REPLY_MESSAGE,
          },
        };

        const response = await axios.post(graphUrl, payload, {
          headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`Auto-reply successfully sent to ${from}. Message ID:`, response.data?.messages?.[0]?.id);
      }
    } catch (error) {
      console.error(
        'Failed to process incoming message or send auto-reply:',
        error.response ? error.response.data : error.message
      );
    }
  } else {
    res.sendStatus(404);
  }
});

// Start local server if not running in serverless environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
