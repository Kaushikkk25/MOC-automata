export class GeminiConfigError extends Error {}

export async function askGemini(prompt: string, systemInstruction?: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemInstruction }),
    });
  } catch {
    throw new Error('Could not reach the AI assistant — check your internet connection.');
  }

  if (!res.ok) {
    let errText = '';
    try {
      const errBody = await res.json();
      errText = errBody?.error || '';
    } catch {
      errText = await res.text().catch(() => '');
    }

    if (res.status === 500 && errText.includes('not configured')) {
      throw new GeminiConfigError(
        'No Gemini API key configured on the server. Set GEMINI_API_KEY in your Vercel project (Settings -> Environment Variables), then redeploy.'
      );
    }
    if (res.status === 404) {
      throw new GeminiConfigError(
        'The /api/gemini endpoint was not found. This only works when deployed on Vercel (or locally via `vercel dev`), not plain `npm run dev`.'
      );
    }
    throw new Error(errText || `Request failed (${res.status})`);
  }

  const data = await res.json();
  if (!data.text) {
    throw new Error('Gemini returned an empty response — try rephrasing your question.');
  }
  return data.text as string;
}