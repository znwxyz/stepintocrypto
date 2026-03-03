const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitState = new Map<string, number[]>();

function parseAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS') || '';
  const fromEnv = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;
  return [
    'https://stepintocrypto.xyz',
    'https://www.stepintocrypto.xyz',
  ];
}

const allowedOrigins = parseAllowedOrigins();

function getRequestIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const firstForwarded = forwarded.split(',')[0]?.trim();
  return firstForwarded || req.headers.get('x-real-ip') || 'unknown';
}

function getCorsHeaders(origin: string | null) {
  const safeOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': safeOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.startsWith('http://localhost:')) return true;
  if (origin.startsWith('http://127.0.0.1:')) return true;
  return false;
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (rateLimitState.get(key) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitState.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimitState.set(key, recent);
  return false;
}

type ContextSnippet = {
  source?: string;
  text?: string;
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, origin);
  }

  if (!isAllowedOrigin(origin)) {
    return jsonResponse(403, { error: 'Origin not allowed' }, origin);
  }

  const requesterKey = `${origin}:${getRequestIp(req)}`;
  if (isRateLimited(requesterKey)) {
    return jsonResponse(429, { error: 'Too many requests' }, origin);
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
    const HF_API_KEY = Deno.env.get('HF_API_KEY');
    const HF_MODEL = Deno.env.get('HF_MODEL') || 'HuggingFaceH4/zephyr-7b-beta';

    const payload = await req.json().catch(() => ({}));
    const question = String(payload?.question || '').trim();
    const contextSnippets = (Array.isArray(payload?.contextSnippets) ? payload.contextSnippets : []) as ContextSnippet[];

    if (!question) {
      return jsonResponse(400, { error: 'question is required' }, origin);
    }

    if (question.length > 500) {
      return jsonResponse(400, { error: 'question is too long' }, origin);
    }

    const contextText = contextSnippets
      .slice(0, 6)
      .map((item, idx) => {
        const source = String(item?.source || `참고 ${idx + 1}`).trim();
        const text = String(item?.text || '').trim();
        return text ? `[${source}]\n${text}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    const systemPrompt = [
      '너는 한국어로 답하는 Step into Crypto 사이트 도우미다.',
      '답변은 친절하지만 짧고 명확하게 작성한다.',
      '주어진 CONTEXT를 우선 사용해 설명하고, CONTEXT에 없는 내용은 단정하지 말고 추정임을 밝힌다.',
      '투자 조언은 하지 않는다.',
      '가능하면 3~6문장으로 끝낸다.',
    ].join(' ');

    const userPrompt = [
      `질문: ${question}`,
      '',
      'CONTEXT:',
      contextText || '제공된 컨텍스트 없음',
    ].join('\n');

    if (OPENAI_API_KEY) {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!openaiRes.ok) {
        return jsonResponse(502, { error: 'OpenAI request failed' }, origin);
      }

      const result = await openaiRes.json();
      const answer = result?.choices?.[0]?.message?.content;
      if (!answer || typeof answer !== 'string') {
        return jsonResponse(502, { error: 'Invalid OpenAI response' }, origin);
      }
      return jsonResponse(200, { answer: answer.trim(), provider: 'openai' }, origin);
    }

    if (HF_API_KEY) {
      const hfPrompt = [
        `[SYSTEM]\n${systemPrompt}`,
        `[USER]\n${userPrompt}`,
        '[ASSISTANT]\n',
      ].join('\n\n');

      const hfRes = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HF_API_KEY}`,
        },
        body: JSON.stringify({
          inputs: hfPrompt,
          parameters: {
            temperature: 0.3,
            max_new_tokens: 320,
            return_full_text: false,
          },
        }),
      });

      const hfJson = await hfRes.json().catch(() => ({}));
      if (!hfRes.ok) {
        return jsonResponse(502, { error: 'Hugging Face request failed' }, origin);
      }

      let answer = '';
      if (Array.isArray(hfJson) && typeof hfJson[0]?.generated_text === 'string') {
        answer = hfJson[0].generated_text;
      } else if (typeof hfJson?.generated_text === 'string') {
        answer = hfJson.generated_text;
      }

      if (!answer.trim()) {
        return jsonResponse(502, { error: 'Invalid Hugging Face response' }, origin);
      }

      return jsonResponse(200, { answer: answer.trim(), provider: 'huggingface' }, origin);
    }

    return jsonResponse(500, {
      error: 'No AI provider configured',
      detail: 'Set OPENAI_API_KEY or HF_API_KEY in Edge Function secrets.',
    }, origin);
  } catch (err) {
    console.error('site-assistant-unhandled', err);
    return jsonResponse(500, {
      error: 'Unhandled error',
    }, origin);
  }
});
