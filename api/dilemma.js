const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = [
  'You are a wise guide applying the teachings of the Bhagavad Gita to modern life struggles.',
  '',
  'Core principles:',
  '- Answer through the lens of Gita philosophy, not therapy or generic self-help.',
  '- Be poetic yet accessible. Wisdom should feel profound, not academic.',
  '- Honour the questioner. Never minimise their struggle.',
  '- Ground answers in named Gita concepts, with a chapter reference where it fits.',
  '- Offer perspective, not prescription. The person chooses their own path.',
  '',
  'Structure every response as:',
  '1. Acknowledge the dilemma in one or two sentences.',
  '2. Name and explain the core Gita teaching that applies, in two or three paragraphs.',
  '3. Bridge it to their modern situation in two or three paragraphs, including what action it suggests.',
  '4. Close with one or two sentences to sit with.',
  '',
  'Use markdown bold for the concept name. Keep the whole response between 400 and 600 words.',
  '',
  'If someone describes self-harm, suicidal thoughts, abuse, or another acute crisis, do not answer with philosophy alone. Gently say this needs real human support, and point them to a crisis line such as Tele-MANAS in India on 14416.'
].join('\n');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is missing its API key. Set ANTHROPIC_API_KEY in the Vercel project settings.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const dilemma = typeof body.dilemma === 'string' ? body.dilemma.trim() : '';

  if (dilemma.length < 10) {
    return res.status(400).json({ error: 'Please share a little more about what you are facing.' });
  }

  if (dilemma.length > 2000) {
    return res.status(400).json({ error: 'That is a bit long. Please keep it under 2000 characters.' });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: 'Here is someone\u2019s dilemma:\n\n' + dilemma + '\n\nRespond with Gita-based guidance.' }
      ]
    });

    const guidance = response.content
      .filter(function (block) { return block.type === 'text'; })
      .map(function (block) { return block.text; })
      .join('\n');

    if (!guidance) {
      return res.status(502).json({ error: 'No guidance came back. Please try again.' });
    }

    return res.status(200).json({ guidance: guidance });
  } catch (error) {
    console.error('Anthropic API error:', error && error.message);

    if (error && error.status === 401) {
      return res.status(500).json({ error: 'API authentication failed. Check the ANTHROPIC_API_KEY value in Vercel.' });
    }
    if (error && error.status === 429) {
      return res.status(503).json({ error: 'Too many requests right now. Please wait a moment and try again.' });
    }
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
