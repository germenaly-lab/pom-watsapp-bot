const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ==========================================
// 1. Credentials & Configuration
// ==========================================
const VERIFY_TOKEN =
  process.env.VERIFY_TOKEN ||
  process.env.POM_VERIFY_TOKEN ||
  'pom_verify_token';

const WHATSAPP_ACCESS_TOKEN =
  process.env.WHATSAPP_TOKEN ||
  process.env.WHATSAPP_ACCESS_TOKEN ||
  'EAAPfesgk6VcBSTMkCsQ1Dbwpgfoui864oO1PJRhM7QIPbZBnA080ELNgXq66M635W5tsbc4NyUoamJWaGDU3iIeZCpgN8kQAV6aIFLj5plIeqMoYeRWZBLdjz2buTlRhu4P6mt2PsCZBTZBQ0kGglgkoL196CXY0ZC4k5ZCggHZBZC6iGxNf1DrvIf0Nsdb8dKgZDZD';

const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID ||
  '1241605315706516';

const PORT = process.env.PORT || 3000;

// Cache to prevent duplicate replies to the same message ID
const processedMessageIds = new Set();

// ==========================================
// 2. Arabic Text Normalization & Keyword Engine
// ==========================================
function normalizeArabicText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    // Remove Arabic Tashkeel / Diacritics
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize Alif forms (أ, إ, آ -> ا)
    .replace(/[أإآ]/g, 'ا')
    // Normalize Taa Marbouta (ة -> ه)
    .replace(/ة/g, 'ه')
    // Normalize Yaa / Alef Maksura (ى -> ي)
    .replace(/ى/g, 'ي')
    // Remove extra whitespaces
    .replace(/\s+/g, ' ');
}

// Auto-reply templates for Power of Media
const RESPONSES = {
  pricing:
    '📊 *باقات وأسعار وكالة Power of Media*\n\n' +
    'نوفر باقات تسويقية متكاملة ومصممة خصيصاً لتناسب أهداف وميزانية مشروعك:\n\n' +
    '1️⃣ *باقة الانطلاق (Starter)*: إدارة السوشيال ميديا + تصاميم احترافية.\n' +
    '2️⃣ *باقة النمو (Growth)*: إدارة الحملات الإعلانية (Media Buying) + صناعة المحتوى.\n' +
    '3️⃣ *الباقة المتكاملة (Enterprise)*: تغطية شاملة (إعلانات + فيديو ريلز + تطوير هوية ومواقع).\n\n' +
    '💬 لمعرفة تفاصيل الأسعار والعرض المخصص لمجال عملك، برجاء إرسال تفاصيل مشروعك وسيتواصل معك مستشارنا التسويقي فوراً.',

  services:
    '🚀 *خدمات وكالة Power of Media (باور أوف ميديا)*:\n\n' +
    '✨ *إدارة الحملات الإعلانية الممولة (Media Buying)*: فيسبوك، انستجرام، تيك توك، جوجل سناب شات.\n' +
    '✨ *صناعة وتصميم المحتوى*: بوستات تفاعلية، فيديو ريلز وموشن جرافيك.\n' +
    '✨ *بناء وتطوير الهوية البصرية (Branding)*: شعارات وهوية تجارية كاملة.\n' +
    '✨ *تصميم وبرمجة المواقع والمتاجر الإلكترونية*.\n' +
    '✨ *حلول الأتمتة وبوتات المحادثة الذكية*.\n\n' +
    'اخبرنا عن الخدمة المطلوبة لنزودك بكافة النماذج وسابقة أعمالنا.',

  fallback:
    'أهلاً بك في وكالة *Power of Media (باور أوف ميديا)*! 🌟\n\n' +
    'شكراً لتواصلك معنا، سنسعد بخدمتك.\n\n' +
    'يمكنك الاستفسار عن:\n' +
    '• *الخدمات*: لمعرفة خدماتنا وسابقة أعمالنا.\n' +
    '• *الأسعار*: للاطلاع على الباقات التسويقية المتاحة.\n\n' +
    'أو اترك استفسارك وسيقوم فريقنا بالرد عليك في أقرب وقت.',
};

function getAutoReplyMessage(userMessageText) {
  const normalized = normalizeArabicText(userMessageText);

  // Keywords for Pricing / Packages
  const pricingKeywords = ['سعر', 'اسعار', 'باقات', 'باقه', 'تكلفه', 'كم سعر', 'pricing', 'price'];
  if (pricingKeywords.some((keyword) => normalized.includes(keyword))) {
    return RESPONSES.pricing;
  }

  // Keywords for Services / Portfolio
  const servicesKeywords = ['خدمات', 'خدمه', 'شغل', 'اعمال', 'تسويق', 'اعلانات', 'سوشيال', 'services'];
  if (servicesKeywords.some((keyword) => normalized.includes(keyword))) {
    return RESPONSES.services;
  }

  // Default Fallback
  return RESPONSES.fallback;
}

// ==========================================
// 3. Express Routes
// ==========================================

// Root health check
app.get('/', (req, res) => {
  res.status(200).send('Power of Media WhatsApp Webhook is live and healthy!');
});

// GET /webhook: Meta Webhook Verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && (token === VERIFY_TOKEN || token === 'pom_bot_123' || token === 'pom_verify_token')) {
      console.log('WEBHOOK_VERIFIED successfully with Meta.');
      return res.status(200).send(challenge);
    } else {
      console.warn(`Webhook verification failed: token mismatch (received: ${token})`);
      return res.sendStatus(403);
    }
  }

  return res.sendStatus(400);
});

// POST /webhook: Handle incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Log incoming body for full transparency in Vercel logs
  console.log('Received Webhook Body:', JSON.stringify(body));

  // Verify that this is a WhatsApp API payload
  if (body.object === 'whatsapp_business_account') {
    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change?.value;
          if (!value) continue;

          // Ignore status updates (sent, delivered, read)
          if (value.statuses && (!value.messages || value.messages.length === 0)) {
            continue;
          }

          // Process incoming customer messages
          const messages = value.messages;
          if (messages && Array.isArray(messages) && messages.length > 0) {
            for (const message of messages) {
              const messageId = message.id;

              // Prevent duplicate replies (idempotency check)
              if (messageId && processedMessageIds.has(messageId)) {
                console.log(`Skipping duplicate message ID: ${messageId}`);
                continue;
              }
              if (messageId) {
                processedMessageIds.add(messageId);
                if (processedMessageIds.size > 1000) {
                  const firstKey = processedMessageIds.values().next().value;
                  processedMessageIds.delete(firstKey);
                }
              }

              // Extract sender phone number safely
              const rawFrom =
                message.from ||
                (value.contacts && value.contacts[0]?.wa_id) ||
                (Array.isArray(value.contacts) && value.contacts.find((c) => c.wa_id)?.wa_id);

              if (!rawFrom) {
                console.warn('Could not extract valid sender phone number (from), skipping:', JSON.stringify(message));
                continue;
              }

              const from = String(rawFrom).trim();
              const messageText = message.text?.body || '';
              const messageType = message.type || 'non-text';

              console.log(`Incoming WhatsApp message from ${from} [type: ${messageType}]: "${messageText}"`);

              // Select tailored response based on keyword engine
              const replyText = getAutoReplyMessage(messageText);

              // Dispatch response via Meta Graph API v25.0
              const graphUrl = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;
              const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: from,
                type: 'text',
                text: {
                  preview_url: false,
                  body: replyText,
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

                console.log(`Auto-reply sent to ${from}. Message ID:`, response.data?.messages?.[0]?.id);
              } catch (sendError) {
                const errorData = sendError.response ? sendError.response.data : sendError.message;
                console.error(`Failed to dispatch auto-reply to ${from}:`, JSON.stringify(errorData));
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

// ==========================================
// 4. Server Initialization
// ==========================================
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
