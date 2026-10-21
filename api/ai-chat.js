// api/ai-chat.js
// Vercel serverless function: Srey AI — Luxury Concierge powered by Google Gemini 1.5 Flash.
//
// Required Vercel env var:
//   GEMINI_API_KEY — Google AI Studio API key

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { message, chatHistory } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Lazy-load ESM-only Gemini SDK (safe under a CommonJS Vercel handler).
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not configured on the server.');
      return res.status(500).json({
        reply: 'I am currently updating my concierge engine. Please try your request again in a moment!',
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `You are Srey AI, an elite Luxury Concierge for the Watch-to-Earn platform on earnings.ink.
      You assist users with platform navigation, TON crypto withdrawals, VIP Lounge perks, and dating advice.
      Be helpful, concise, sophisticated, and directly address the user's questions.`,
    });

    const result = await model.generateContent(message);
    const responseText = result.response.text();

    return res.status(200).json({ reply: responseText });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      reply: 'I am currently updating my concierge engine. Please try your request again in a moment!',
    });
  }
}
