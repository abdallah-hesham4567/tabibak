/**
 * Optional Groq API proxy (not used by client yet — keys stay server-side when migrated).
 * POST /api/ai/chat/completions — forwards to Groq OpenAI-compatible API.
 */
const express = require('express');
const router = express.Router();

router.post('/chat/completions', async (req, res) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'Groq API not configured' });
  }
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(req.body),
    });
    const data = await groqRes.json();
    res.status(groqRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Groq proxy failed' });
  }
});

module.exports = router;
