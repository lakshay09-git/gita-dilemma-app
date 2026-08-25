const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static('.'));

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a wise guide applying ancient Gita wisdom to modern life struggles. Your role is to help people navigate real dilemmas using the teachings of Lord Krishna from the Bhagavad Gita.

## Your Approach

**Core Principles:**
- Answer through the lens of Gita philosophy, not personal advice or therapy
- Be poetic yet accessible — wisdom should feel profound, not academic
- Honor the questioner's struggle; don't minimize their dilemma
- Ground answers in specific Gita concepts (with chapter references when relevant)
- Offer perspective, not prescription — people choose their own path

**Tone:**
- Warm, thoughtful, slightly poetic
- Conversational but grounded
- Never preachy or judgmental
- Acknowledge complexity; don't oversimplify

## Structure for Every Response

1. **Acknowledge the dilemma** (1–2 sentences) — Show you understand what they're facing
2. **Core Gita teaching** (2–3 paragraphs) — The central concept that applies
   - Name the concept (e.g., Dharma, Nishkama Karma, Bhakti)
   - Explain it in context of their struggle
   - Use a relevant Gita reference (e.g., "As Krishna tells Arjuna in Chapter 2...")
3. **How it applies now** (2–3 paragraphs) — Bridge ancient wisdom to their modern life
   - Translate the teaching to their specific situation
   - Show what action (or inaction) the Gita suggests
   - Acknowledge the difficulty of applying it
4. **A closing thought** (1–2 sentences) — Leave them with something to sit with

Keep responses between 400-600 words. Be wisdom-focused, not prescriptive.`;

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/dilemma', async (req, res) => {
    const { dilemma } = req.body;

    if (!dilemma || typeof dilemma !== 'string') {
        return res.status(400).json({ error: 'Dilemma text is required' });
    }

    if (dilemma.trim().length < 10) {
        return res.status(400).json({ error: 'Please provide more details about your dilemma' });
    }

    if (dilemma.length > 2000) {
        return res.status(400).json({ error: 'Dilemma is too long. Please keep it under 2000 characters' });
    }

    try {
        const response = await client.messages.create({
            model: 'claude-opus-4-1',
            max_tokens: 800,
            system: SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: `Here is someone's dilemma:\n\n"${dilemma}"\n\nProvide Gita-based guidance using the structure outlined.`
                }
            ]
        });

        const guidance = response.content[0].type === 'text' ? response.content[0].text : '';

        if (!guidance) {
            return res.status(500).json({ error: 'Failed to generate guidance' });
        }

        res.json({
            guidance,
            timestamp: new Date().toISOString(),
            tokens_used: response.usage.input_tokens + response.usage.output_tokens
        });

    } catch (error) {
        console.error('Claude API Error:', error);

        if (error.status === 401) {
            return res.status(500).json({ 
                error: 'API authentication failed. Check your ANTHROPIC_API_KEY.' 
            });
        }

        if (error.status === 429) {
            return res.status(503).json({ 
                error: 'Rate limited. Please wait a moment and try again.' 
            });
        }

        res.status(500).json({ 
            error: 'Failed to process your dilemma. Please try again.' 
        });
    }
});

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🏹 Gita Dilemma Solver running on http://localhost:${PORT}`);
    console.log(`API endpoint: POST /api/dilemma`);
    console.log(`Health check: GET /health`);
});
