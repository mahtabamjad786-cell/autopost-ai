import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { prisma } from '../db.js';

const OUTPUT_DIR = path.resolve('uploads/generated');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Overlays a simple text watermark in the bottom-right corner using an SVG
 * layer composited onto the image. Swap the SVG for your own logo file with
 * `sharp(logoPath).resize(...)` if you'd rather brand with an image mark.
 */
async function applyWatermark(filePath, text = 'AutoPost AI') {
  const image = sharp(filePath);
  const { width, height } = await image.metadata();
  const fontSize = Math.round(width * 0.028);
  const padding = Math.round(width * 0.02);

  const svg = `
    <svg width="${width}" height="${height}">
      <style>
        .wm { fill: rgba(255,255,255,0.75); font-size: ${fontSize}px; font-family: sans-serif; }
        .wm-shadow { fill: rgba(0,0,0,0.45); font-size: ${fontSize}px; font-family: sans-serif; }
      </style>
      <text x="${width - padding + 1}" y="${height - padding + 1}" text-anchor="end" class="wm-shadow">${text}</text>
      <text x="${width - padding}" y="${height - padding}" text-anchor="end" class="wm">${text}</text>
    </svg>`;

  const buffer = await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  fs.writeFileSync(filePath, buffer);
}

async function getApiKey(provider) {
  const row = await prisma.apiKey.findUnique({ where: { provider } });
  if (row?.isActive) return row.keyValue;
  const envMap = {
    OPENAI_IMAGES: process.env.OPENAI_IMAGES_API_KEY,
    IMAGEN: process.env.GOOGLE_IMAGEN_API_KEY,
    FLUX: process.env.FLUX_API_KEY,
    STABILITY: process.env.STABILITY_API_KEY,
  };
  return envMap[provider];
}

function dimsForOrientation(orientation) {
  if (orientation === 'landscape') return { width: 1792, height: 1024 };
  if (orientation === 'square') return { width: 1024, height: 1024 };
  return { width: 1024, height: 1792 }; // portrait default
}

async function saveBase64Png(base64, filename) {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return `/uploads/generated/${filename}`;
}

async function callOpenAIImages(prompt, apiKey, orientation) {
  const size = orientation === 'landscape' ? '1792x1024' : orientation === 'square' ? '1024x1024' : '1024x1792';
  const { data } = await axios.post(
    'https://api.openai.com/v1/images/generations',
    { model: 'gpt-image-1', prompt, size, n: 1 },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const b64 = data.data[0].b64_json;
  return saveBase64Png(b64, `${Date.now()}.png`);
}

async function callStability(prompt, apiKey, orientation) {
  const { width, height } = dimsForOrientation(orientation);
  const { data } = await axios.post(
    'https://api.stability.ai/v2beta/stable-image/generate/core',
    { prompt, aspect_ratio: width > height ? '16:9' : width === height ? '1:1' : '9:16' },
    { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } }
  );
  return saveBase64Png(data.image, `${Date.now()}.png`);
}

async function callFlux(prompt, apiKey, orientation) {
  const { width, height } = dimsForOrientation(orientation);
  const { data } = await axios.post(
    'https://api.bfl.ml/v1/flux-pro-1.1',
    { prompt, width, height },
    { headers: { 'x-key': apiKey } }
  );
  // Flux returns a polling URL in real usage; simplified here for scaffold clarity.
  return data.result_url || null;
}

async function callImagen(prompt, apiKey, orientation) {
  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
    { instances: [{ prompt }], parameters: { sampleCount: 1 } }
  );
  const b64 = data.predictions[0].bytesBase64Encoded;
  return saveBase64Png(b64, `${Date.now()}.png`);
}

/**
 * Returns an image URL (local path or remote URL) for the given post text.
 */
export async function generateImage({ subtopic, tone, topic }) {
  const settings = await prisma.adminSettings.findUnique({ where: { id: 1 } });
  const provider = settings?.imageProvider || 'OPENAI_IMAGES';
  const orientation = settings?.imageOrientation || 'portrait';
  const apiKey = await getApiKey(provider);

  const prompt = `A high-quality, realistic social-media graphic illustrating "${subtopic}" related to ${topic}. Clean composition, ${tone.toLowerCase()} mood, no embedded text or watermarks.`;

  if (!apiKey) {
    return null; // caller falls back to a placeholder / text-only post
  }

  let imageUrl;
  switch (provider) {
    case 'OPENAI_IMAGES': imageUrl = await callOpenAIImages(prompt, apiKey, orientation); break;
    case 'STABILITY': imageUrl = await callStability(prompt, apiKey, orientation); break;
    case 'FLUX': imageUrl = await callFlux(prompt, apiKey, orientation); break; // remote URL — watermarking not applied, see note below
    case 'IMAGEN': imageUrl = await callImagen(prompt, apiKey, orientation); break;
    default: return null;
  }

  // Watermark only applies to locally-saved files (i.e. not a bare remote
  // URL like Flux's polling result). To watermark Flux output too, download
  // the remote image first, then run it through applyWatermark() below.
  if (settings?.watermarkEnabled && imageUrl && !imageUrl.startsWith('http')) {
    const localPath = path.join(OUTPUT_DIR, path.basename(imageUrl));
    await applyWatermark(localPath);
  }

  return imageUrl;
}
