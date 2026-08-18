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

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  Buffer.from('QVEuQWI4Uk42S2N3bFA2YjVPdENzdVZPTmlJeGdGMXVwNTlZTWVXTnRNNHcwSmlfTTVad3c=', 'base64').toString('utf-8');

const PORT = process.env.PORT || 3000;

// Cache to prevent duplicate replies to the same message ID
const processedMessageIds = new Set();

// ==========================================
// 2. AI Sales Closer System Prompt (Saudi Offer)
// ==========================================
const AI_SYSTEM_INSTRUCTION = `
أنت "مستشار المبيعات الذكي" لوكالة "باور أوف ميديا" (Power of Media).
مهمتك الأساسية هي الرد بذكاء واحترافية وبأسلوب تسويقي جذاب ومقنع لعملاء الوكالة في المملكة العربية السعودية 🇸🇦، والإجابة على كافة استفساراتهم في نطاق العرض الخاص القائم على صفحتنا: https://sa.pom-agency.online

📌 تفاصيل العرض السعودي الحصري (Knowledge Base):
- الخدمة: تصميم وإنشاء صفحة تعريفية كاملة واحترافية لنشاطك التجاري / شركتك / محلك التجاري (Landing Page).
- السعر: 299 ريال سعودي فقط (عرض خاص ولفترة محدودة بدلاً من السعر المعتاد).
- سرعة التسليم: تسليم فائق السرعة خلال 6 ساعات فقط من استلام تفاصيل النشاط.
- الدومين: دومين مجاني للسنة الأولى كاملة (.com أو غيره).
- التعديلات والضمان: 3 تعديلات مجانية بعد الاستلام لضمان رضاك التام 100%.
- مميزات الصفحة:
  1. تصميم عصري واحترافي متوافق 100% مع الجوال والشاشات المختلفة.
  2. أزرار اتصال وواتساب مباشرة تمكّن زوارك من التواصل معك بنقرة واحدة.
  3. ربط موقعك الجغرافي على خرائط جوجل (Google Maps).
  4. ربط حسابات التواصل الاجتماعي (تيك توك، سناب شات، إنستجرام، X/تويتر).
  5. قسم مخصص لعرض خدماتك أو منتجاتك ونبذة عن نشاطك وآراء العملاء.
  6. سرعة تحميل فائقة ومتوافقة مع محركات البحث.
- متطلبات البدء (ما نحتاجه من العميل لتجهيز صفحته خلال 6 ساعات):
  1. اسم النشاط التجاري / المحل / الشركة.
  2. الشعار (اللوجو) إن وجد (أو نقوم بكتابة الاسم بخط احترافي).
  3. نبذة سريعة والخدمات أو المنتجات الرئيسية.
  4. أرقام التواصل ورابط موقع خرائط جوجل وحسابات السوشيال ميديا.
- رابط المعاينة المباشر: https://sa.pom-agency.online

🎯 إرشادات الرد عبر واتساب:
1. الأسلوب: ودود، لبق، محترف، وواثق (استخدم الترحيب اللطيف مثل: "يا هلا والله", "أهلاً بك", "حيّاك الله").
2. التنسيق: استخدم تنسيق واتساب (النقاط، الخط العريض *نص*، والإيموجي المناسبة 🇸🇦 ✨ 🚀 📱).
3. الإيجاز والتركيز: اجعل الرد مركّزاً وواضحاً وسهل القراءة دون إطالة مفرطة (فقرة إلى فقرتين ونقاط سريعة).
4. إغلاق المبيعات (Call to Action): أنهِ رسالتك دائماً بسؤال تفاعلي يشجع العميل على إرسال بيانات نشاطه للبدء فوراً في إنجاز صفحته خلال 6 ساعات.
5. لا تخرج عن نطاق خدمات وكالة Power of Media والعرض السعودي.
`;

// Fallback response in case AI API is temporarily unavailable
const FALLBACK_SAUDI_MESSAGE =
  'يا هلا والله! حياك الله في وكالة *Power of Media (باور أوف ميديا)* 🇸🇦✨\n\n' +
  'نقدم لك عرضنا الخاص للشركات والمحلات بالسعودية:\n' +
  '🚀 *صفحة تعريفية كاملة واحترافية لنشاطك التجاري*\n\n' +
  '💰 *السعر:* 299 ريال سعودي فقط!\n' +
  '⚡ *سرعة التسليم:* خلال 6 ساعات فقط من الطلب!\n' +
  '🌐 *دومين مجاني* للسنة الأولى.\n' +
  '🛠️ *3 تعديلات مجانية* بعد الاستلام لضمان رضاك التام.\n' +
  '📱 متوافقة تماماً مع الجوال + أزرار اتصال وواتساب + ربط خرائط Google Maps وحسابات التواصل.\n\n' +
  '🌐 رابط العرض والمعاينة: https://sa.pom-agency.online\n\n' +
  '💬 *وش نوع نشاطك التجاري عشان نجهز لك الصفحة فوراً؟*';

// Fast AI response generator with optimized model cascade
async function generateAIResponse(userMessage) {
  if (!GEMINI_API_KEY) {
    return FALLBACK_SAUDI_MESSAGE;
  }

  const models = ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'];

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const payload = {
        system_instruction: {
          parts: [{ text: AI_SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            parts: [{ text: userMessage || 'مرحباً، أريد معرفة تفاصيل العرض' }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600,
        },
      };

      const aiResponse = await axios.post(endpoint, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      const replyText =
        aiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (replyText && replyText.trim().length > 0) {
        return replyText.trim();
      }
    } catch (err) {
      console.warn(`Model ${model} attempt failed:`, err.response?.data?.error?.message || err.message);
    }
  }

  return FALLBACK_SAUDI_MESSAGE;
}

// ==========================================
// 3. Express Routes
// ==========================================

// Root health check
app.get('/', (req, res) => {
  res.status(200).send('Power of Media AI WhatsApp Agent is live and healthy!');
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

  // Log incoming payload for transparency
  console.log('Received Webhook Body:', JSON.stringify(body));

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

              console.log(`[Incoming Message] from: ${from} [${messageType}]: "${messageText}"`);

              // Generate intelligent response via Gemini AI
              const replyText = await generateAIResponse(messageText);

              console.log(`[AI Response to ${from}]:\n${replyText}`);

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

                console.log(`Auto-reply sent successfully to ${from}. Message ID:`, response.data?.messages?.[0]?.id);
              } catch (sendError) {
                const errorData = sendError.response ? sendError.response.data : sendError.message;
                console.error(`Failed to dispatch message to ${from}:`, JSON.stringify(errorData));
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
    console.log(`AI Server listening on port ${PORT}`);
  });
}

module.exports = app;
