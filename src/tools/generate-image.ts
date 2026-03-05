import { loadSettings } from '../storage';

const NANO_BANANA_PRO_MODEL = 'gemini-3-pro-image-preview';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GenerateImageResult {
  imageDataUrl: string;
  summary: string;
}

export async function generateImage(prompt: string): Promise<GenerateImageResult> {
  const geminiSettings = loadSettings('gemini');
  if (!geminiSettings?.apiKey) {
    throw new Error(
      'Gemini API key is required for image generation (Nano Banana Pro). ' +
      'Configure it in \u2699 Settings \u2192 Gemini, even if you use a different chat provider.',
    );
  }

  const url = `${API_BASE}/models/${NANO_BANANA_PRO_MODEL}:generateContent?key=${geminiSettings.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['Image', 'Text'],
      },
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch { /* ignore */ }
    throw new Error(
      `Image generation failed (${response.status}): ${detail || response.statusText}`,
    );
  }

  const data = await response.json() as NanoBananaResponse;

  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(
      blockReason
        ? `Image generation blocked: ${blockReason}`
        : 'No image generated — the model returned no candidates.',
    );
  }

  const parts = candidates[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    throw new Error('No image generated — the response contained no parts.');
  }

  let imageDataUrl = '';
  let textPart = '';

  for (const part of parts) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'image/png';
      imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
    }
    if (part.text) {
      textPart = part.text;
    }
  }

  if (!imageDataUrl) {
    throw new Error(
      textPart
        ? `Model returned text instead of an image: ${textPart}`
        : 'No image found in the response.',
    );
  }

  return {
    imageDataUrl,
    summary: textPart || 'Image generated successfully.',
  };
}

interface NanoBananaPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface NanoBananaCandidate {
  content?: { parts?: NanoBananaPart[] };
}

interface NanoBananaResponse {
  candidates?: NanoBananaCandidate[];
  promptFeedback?: { blockReason?: string };
}
