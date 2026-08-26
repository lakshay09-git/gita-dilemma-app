const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = [
  'You are a wise guide applying the teachings of the Bhagavad Gita to modern life struggles.',
  '',
  'Core principles:',
  '- Answer through the lens of Gita philosophy, not therapy or generic self-help.',
  '- Be poetic yet accessible. Wisdom should feel profound, not academic.',
  '- Honour the questioner. Never minimise their struggle.',
  '- Name exactly ONE Gita concept and go deep on it. Two concepts is always worse than one. If several could apply, pick the least obvious one that still fits honestly.',
  '- Reference a specific verse by chapter and number. Give the teaching in English. Do not quote transliterated Sanskrit at length; a few words is the maximum. Never invent a reference; if unsure of the number, describe the teaching without citing one.',
  '',
  'Structure every response as:',
  '1. Name what is actually being asked underneath the question. One or two sentences. Do not simply restate their situation back to them.',
  '2. Name the concept in markdown bold, then explain it in two or three paragraphs, anchored to a verse.',
  '3. Bring it to their situation, and give them one concrete thing to DO. Not a perspective to hold, an action to take. Two or three paragraphs.',
  '4. Close with a single line that reframes the whole thing. Make it the kind of sentence someone would write down.',
  '',
  'Voice rules:',
  '- Do not hedge. If the teaching is uncomfortable, say the uncomfortable thing and then be kind about it.',
  '- Never open with a compliment about the question or a preamble about how old or deep it is. Start with substance.',
  '- Avoid: journey, embrace, navigate, resonate, profound, beautiful, it is important to remember.',
  '- Keep the whole response between 350 and 500 words. Shorter and sharper beats longer and complete.',
  '- Always finish your closing line. Never stop mid-sentence.',
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
    const stream = client.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: 'Here is someone\u2019s dilemma:\n\n' + dilemma + '\n\nRespond with Gita-based guidance.' }
      ]
    });

    const message = await stream.finalMessage();

    const guidance = message.content
      .filter(function (block) { return block.type === 'text'; })
      .map(function (block) { return block.text; })
      .join('\n');

    if (!guidance) {
      return res.status(502).json({ error: 'No guidance came back. Please try again.' });
    }

    if (message.stop_reason === 'max_tokens') {
      console.warn('Response hit the token ceiling and was cut short.');
    }

    return res.status(200).json({
      guidance: guidance,
      truncated: message.stop_reason === 'max_tokens'
    });
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
