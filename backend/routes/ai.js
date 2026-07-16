const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/ai/suggest-tasks
// @desc    Use Gemini to generate task suggestions for a project
// @access  Private
router.post('/suggest-tasks', protect, async (req, res) => {
  const { title, description } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Project title is required for suggestions' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ success: false, message: 'AI service not configured. Add GEMINI_API_KEY to .env' });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a professional project manager. A user just created a project with the following details:

Project Title: "${title.trim()}"
${description?.trim() ? `Project Description: "${description.trim()}"` : ''}

Generate a practical task breakdown for this project. Return ONLY a valid JSON array (no markdown, no explanation) with 6 to 8 tasks. Each task must follow this exact schema:

[
  {
    "title": "Short, actionable task title (max 60 chars)",
    "description": "One-sentence description of what to do (max 120 chars)",
    "priority": "high" | "medium" | "low"
  }
]

Rules:
- Tasks should be concrete and immediately actionable
- Order tasks logically (setup/planning first, delivery last)
- Assign priority based on criticality: high = blocking/critical, medium = important, low = nice-to-have
- Do NOT wrap the JSON in markdown code fences
- Return ONLY the raw JSON array`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();

    // Robustly parse — strip any accidental markdown fences
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let suggestions;

    try {
      suggestions = JSON.parse(cleaned);
    } catch {
      console.error('Gemini returned non-JSON:', rawText);
      return res.status(500).json({ success: false, message: 'AI returned an unexpected response. Please try again.' });
    }

    // Validate and sanitize the array
    if (!Array.isArray(suggestions)) {
      return res.status(500).json({ success: false, message: 'AI returned an unexpected format. Please try again.' });
    }

    const validPriorities = ['high', 'medium', 'low'];
    const sanitized = suggestions
      .filter((s) => s && typeof s.title === 'string' && s.title.trim())
      .slice(0, 10)
      .map((s, i) => ({
        id: i,
        title: s.title.trim().substring(0, 200),
        description: typeof s.description === 'string' ? s.description.trim().substring(0, 300) : '',
        priority: validPriorities.includes(s.priority) ? s.priority : 'medium',
      }));

    if (sanitized.length === 0) {
      return res.status(500).json({ success: false, message: 'AI could not generate suggestions. Please try again.' });
    }

    console.log(`🤖 AI generated ${sanitized.length} task suggestions for project: "${title}"`);
    res.json({ success: true, data: sanitized });
  } catch (err) {
    console.error('Gemini API error:', err.message);
    const msg = err.message?.includes('API_KEY') || err.message?.includes('403')
      ? 'Invalid or missing Gemini API key. Check your .env file.'
      : err.message?.includes('quota') || err.message?.includes('429')
      ? 'AI quota exceeded. Please try again in a moment.'
      : 'AI service error. Please try again.';
    res.status(500).json({ success: false, message: msg });
  }
});

module.exports = router;
