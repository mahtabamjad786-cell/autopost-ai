import axios from 'axios';
import { prisma } from '../db.js';

/**
 * Pluggable text generation. The admin picks the active provider in
 * AdminSettings; this module routes the request to the right API.
 * Adding a new provider = add a case here + one row in ApiKey.
 */

async function getApiKey(provider) {
  const row = await prisma.apiKey.findUnique({ where: { provider } });
  if (row?.isActive) return row.keyValue;
  // fall back to env vars for local dev
  const envMap = {
    OPENAI: process.env.OPENAI_API_KEY,
    CLAUDE: process.env.ANTHROPIC_API_KEY,
    GEMINI: process.env.GEMINI_API_KEY,
    GROK: process.env.GROK_API_KEY,
  };
  return envMap[provider];
}

async function callOpenAI(prompt, apiKey, temperature) {
  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature,
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  return data.choices[0].message.content.trim();
}

async function callClaude(prompt, apiKey, temperature) {
  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    },
    { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } }
  );
  return data.content.map((b) => b.text || '').join('\n').trim();
}

async function callGemini(prompt, apiKey, temperature) {
  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature } }
  );
  return data.candidates[0].content.parts.map((p) => p.text).join('\n').trim();
}

async function callGrok(prompt, apiKey, temperature) {
  const { data } = await axios.post(
    'https://api.x.ai/v1/chat/completions',
    { model: 'grok-2-latest', messages: [{ role: 'user', content: prompt }], temperature },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  return data.choices[0].message.content.trim();
}

/**
 * Generates: { subtopic, postText, hashtags: string[] }
 */
export async function generatePost({ topic, language, tone, subtopic, hashtagCount }) {
  const settings = await prisma.adminSettings.findUnique({ where: { id: 1 } });
  const provider = settings?.textProvider || 'OPENAI';
  const temperature = settings?.aiCreativityLevel ?? 0.7;
  const apiKey = await getApiKey(provider);

  const prompt = `You are a social media copywriter. Write ONE Facebook post.
Main topic: "${topic}"
Today's specific subtopic: "${subtopic}"
Language: ${language}
Tone: ${tone}
Requirements:
- 60 to 150 words, engaging, no markdown formatting, no emojis overload (max 2-3).
- End with exactly ${hashtagCount} relevant hashtags on their own line, space-separated, starting with #.
- Do not repeat generic filler; be specific to the subtopic.
Return ONLY the post text (including the hashtag line at the end).`;

  if (!apiKey) {
    // No key configured yet — return a clearly-labeled placeholder so the
    // rest of the pipeline (scheduling, image gen, publishing) can still be
    // exercised end-to-end during setup.
    return {
      postText: `[DEMO MODE — configure a ${provider} API key in Admin Settings]\n\n${subtopic}: this is placeholder content for "${topic}".`,
      hashtags: Array.from({ length: hashtagCount }, (_, i) => `#${topic.replace(/\s+/g, '')}${i + 1}`),
    };
  }

  let raw;
  switch (provider) {
    case 'OPENAI': raw = await callOpenAI(prompt, apiKey, temperature); break;
    case 'CLAUDE': raw = await callClaude(prompt, apiKey, temperature); break;
    case 'GEMINI': raw = await callGemini(prompt, apiKey, temperature); break;
    case 'GROK': raw = await callGrok(prompt, apiKey, temperature); break;
    default: throw new Error(`Unknown text provider: ${provider}`);
  }

  const lines = raw.split('\n').filter(Boolean);
  const hashtagLine = lines.find((l) => l.trim().startsWith('#')) || '';
  const hashtags = hashtagLine.match(/#\S+/g) || [];
  const postText = raw.replace(hashtagLine, '').trim();

  return { postText, hashtags };
}

/**
 * Generates the next subtopic for a topic, avoiding repeats already used.
 */
export async function generateSubtopic({ topic, language, usedSubtopics }) {
  const settings = await prisma.adminSettings.findUnique({ where: { id: 1 } });
  const provider = settings?.textProvider || 'OPENAI';
  const apiKey = await getApiKey(provider);

  if (!apiKey) {
    return `${topic} — tip #${usedSubtopics.length + 1}`;
  }

  const prompt = `Main topic: "${topic}". Already covered subtopics: ${JSON.stringify(
    usedSubtopics
  )}. Suggest ONE new, specific subtopic (5-8 words) not yet covered, in ${language}. Return ONLY the subtopic text, nothing else.`;

  let raw;
  switch (provider) {
    case 'OPENAI': raw = await callOpenAI(prompt, apiKey, 0.9); break;
    case 'CLAUDE': raw = await callClaude(prompt, apiKey, 0.9); break;
    case 'GEMINI': raw = await callGemini(prompt, apiKey, 0.9); break;
    case 'GROK': raw = await callGrok(prompt, apiKey, 0.9); break;
    default: raw = `${topic} — tip #${usedSubtopics.length + 1}`;
  }
  return raw.replace(/["\n]/g, '').trim();
}
