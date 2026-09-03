export const config = { runtime: 'edge' };

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: { history?: Array<{ role?: string; text?: string }>; systemInstruction?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { history, systemInstruction } = body;
  if (!Array.isArray(history) || history.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing non-empty "history" array in request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const geminiBody: Record<string, unknown> = {
    contents: history.map((turn) => ({
      role: turn.role === 'model' ? 'model' : 'user',
      parts: [{ text: turn.text || '' }],
    })),
  };
  if (systemInstruction) {
    geminiBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  let geminiRes: Response;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(geminiBody),
      }
    );
  } catch {
    return new Response(JSON.stringify({ error: 'Could not reach the Gemini API.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => '');
    return new Response(
      JSON.stringify({ error: `Gemini API error (${geminiRes.status}): ${errText || geminiRes.statusText}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const data = await geminiRes.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';

  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}