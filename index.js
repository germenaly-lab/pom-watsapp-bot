const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Credentials & Configuration
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pom_bot_123';
const WHATSAPP_ACCESS_TOKEN =
  process.env.WHATSAPP_ACCESS_TOKEN ||
  'EAAPfesgk6VcBSTMkCsQ1Dbwpgfoui864oO1PJRhM7QIPbZBnA080ELNgXq66M635W5tsbc4NyUoamJWaGDU3iIeZCpgN8kQAV6aIFLj5plIeqMoYeRWZBLdjz2buTlRhu4P6mt2PsCZBTZBQ0kGglgkoL196CXY0ZC4k5ZCggHZBZC6iGxNf1DrvIf0Nsdb8dKgZDZD';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '1241605315706516';
const PORT = process.env.PORT || 3000;

// Auto-reply Arabic message
const AUTO_REPLY_MESSAGE =
  'أهلاً بك في وكالة باور أوف ميديا! كراً لتواصلك معنا، سنسعد بخدمتك قريباً.';

// Cache to prevent duplicate replies to the same message ID
const processedMessageIds = new Set();

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
    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change?.value;
          if (!value) continue;

          // Ignore message status updates (sent, delivered, read)
          if (value.statuses) {
            continue;
          }

          // Process incoming customer messages
          const messages = value.messages;
          if (messages && Array.isArray(messages) && messages.length > 0) {
            for (const message of messages) {
              const messageId = message.id;

              // Prevent processing duplicate webhook deliveries
              if (messageId && processedMessageIds.has(messageId)) {
                console.log(`Skipping duplicate message: ${messageId}`);
                continue;
              }
              if (messageId) {
                processedMessageIds.add(messageId);
                // Keep cache size bounded
                if (processedMessageIds.size > 1000) {
                  const firstKey = processedMessageIds.values().next().value;
                  processedMessageIds.delete(firstKey);
                }
              }

              // Safely extract sender's phone number
              const from = message.from || value.contacts?.[0]?.wa_id;
              if (!from) {
                console.warn('Could not extract valid sender phone number (from), skipping:', JSON.stringify(message));
                continue;
              }

              const msgContent = message.text?.body || message.type || 'non-text message';
              console.log(`Processing incoming WhatsApp message from ${from}: ${msgContent}`);

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

              try {
                const response = await axios.post(graphUrl, payload, {
                  headers: {
                    Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                  },
                  timeout: 15000,
                });

                console.log(`Auto-reply successfully sent to ${from}. Message ID:`, response.data?.messages?.[0]?.id);
              } catch (sendError) {
                console.error(
                  `Failed to send auto-reply to ${from}:`,
                  sendError.response ? sendError.response.data : sendError.message
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error processing webhook payload:', err.message);
    }

    // Acknowledge Meta AFTER completing async work to prevent Vercel container freeze
    return res.status(200).send('EVENT_RECEIVED');
  } else {
    return res.sendStatus(404);
  }
});

// Start local server if not running in serverless environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
