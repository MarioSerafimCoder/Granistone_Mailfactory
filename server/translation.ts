import type { TranslationRequest, TranslationResult } from '@/types/online';
import { clean, HttpError, type Env } from './platform';

function input(value: unknown): TranslationRequest {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'Pedido de tradução inválido.');
  const candidate = value as Partial<TranslationRequest>;
  if (!['en', 'es'].includes(String(candidate.target)) || !Array.isArray(candidate.items) || candidate.items.length > 100)
    throw new HttpError(400, 'Pedido de tradução inválido.');
  const items = candidate.items.map((item) => ({
    id: clean(item?.id, 100),
    text: typeof item?.text === 'string' ? item.text.slice(0, 8_000) : '',
  }));
  if (items.some((item) => !item.id || !item.text) || new Set(items.map((item) => item.id)).size !== items.length)
    throw new HttpError(400, 'Há campos de tradução inválidos.');
  if (items.reduce((total, item) => total + item.text.length, 0) > 30_000)
    throw new HttpError(413, 'O conteúdo é grande demais para uma tradução única.');
  return { target: candidate.target as 'en' | 'es', items };
}

export async function translateContent(value: unknown, env: Env): Promise<TranslationResult> {
  if (!env.GEMINI_API_KEY) throw new HttpError(503, 'A tradução ainda não foi configurada.');
  const request = input(value);
  if (!request.items.length) return request;
  const language = request.target === 'en' ? 'English' : 'Spanish';
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `Translate Brazilian Portuguese marketing copy into natural ${language}. Preserve Granistone, stone and product names. Do not add facts. Preserve capitalization, punctuation and line breaks. Return every id exactly once.` }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(request.items) }] }],
      generationConfig: {
        temperature: 0.15,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: { id: { type: 'STRING' }, text: { type: 'STRING' } },
            required: ['id', 'text'],
          },
        },
      },
    }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new HttpError(429, 'O limite gratuito de tradução foi atingido. Aguarde um pouco e tente novamente.');
    if (response.status === 401 || response.status === 403) throw new HttpError(503, 'A chave de tradução precisa ser renovada.');
    throw new HttpError(503, 'O serviço de tradução está temporariamente indisponível.');
  }
  const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  let items: TranslationResult['items'];
  try { items = JSON.parse(raw || ''); }
  catch { throw new HttpError(502, 'A tradução retornou em um formato inesperado. Tente novamente.'); }
  const expected = new Set(request.items.map((item) => item.id));
  if (!Array.isArray(items) || items.length !== expected.size || items.some((item) => !item || !expected.has(item.id) || typeof item.text !== 'string'))
    throw new HttpError(502, 'A tradução não incluiu todos os campos. Tente novamente.');
  return { target: request.target, items: items.map((item) => ({ id: item.id, text: item.text.slice(0, 10_000) })) };
}
