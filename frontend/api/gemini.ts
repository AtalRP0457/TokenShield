/**
 * Vercel server function: real Gemini for the demo site (POST /api/gemini).
 *
 * The demo (VITE_USE_MOCK=true) runs its agents in the browser, but the Oracle's
 * readings and "Ask the Oracle" answers come from here, live from Gemini.
 *
 *  - The key lives ONLY in Vercel's environment (GEMINI_API_KEY). It never reaches the browser.
 *  - Built for the FREE tier: Flash-Lite models, a per-visitor rate limit, small prompts.
 *  - On any failure (no key, quota used up, timeout) it answers 503/429 and the site falls
 *    back to its built-in answers, so the demo never breaks.
 */
export const config = { runtime: 'edge' };

// Vercel provides process.env in edge functions; declared here because the project has no @types/node.
declare const process: { env: Record<string, string | undefined> };

const MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  ...(process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.1-flash-lite').split(',').map((m) => m.trim()).filter(Boolean),
];

/* ---------- rate limit (best effort, per server instance) ---------- */
const PER_MINUTE = 6;
const PER_HOUR_GLOBAL = 120;
const hits = new Map<string, number[]>();
let globalHits: number[] = [];

function allowed(ip: string): boolean {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < 3_600_000);
  const mine = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (mine.length >= PER_MINUTE || globalHits.length >= PER_HOUR_GLOBAL) return false;
  mine.push(now);
  globalHits.push(now);
  hits.set(ip, mine);
  if (hits.size > 5_000) hits.clear();
  return true;
}

/* ---------- prompts (same rules as the Python backend) ---------- */
const PLAIN_RULES =
  'WRITING STYLE (very important): the reader may be a beginner who has never written code.\n' +
  '- Use short sentences and everyday words. No jargon. If a technical word is unavoidable, explain it in a few words in brackets.\n' +
  '- Say what happened, why it matters (money or time wasted) and what to do next, in that order.\n' +
  "- Use concrete numbers from the data. Dollar amounts are ESTIMATES; say 'about' or 'roughly'.\n" +
  '- Never invent facts that are not in the data.\n';

const SECRET = /(AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{16,}|Bearer\s+\S+|(api[_-]?key|token|secret|password)\s*[=:]\s*\S+)/gi;

function clean(v: unknown, depth = 0): unknown {
  if (depth > 4) return null;
  if (typeof v === 'string') return v.replace(SECRET, '[REDACTED]').slice(0, 300);
  if (Array.isArray(v)) return v.slice(0, 15).map((x) => clean(x, depth + 1));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).slice(0, 30).map(([k, x]) => [k.slice(0, 60), clean(x, depth + 1)]));
  return v;
}

function analyzePrompt(incident: unknown) {
  return (
    'You explain problems in an AI-agent monitoring tool called TokenShield.\n' +
    'A rule-based detector ALREADY flagged this incident; do not question whether it happened.\n' +
    'All dollar figures are ESTIMATES. Use ONLY the data below.\n' + PLAIN_RULES +
    'Respond with a single JSON object with exactly these keys:\n' +
    'plain_explanation (string: 2-3 simple sentences a non-programmer understands, with one everyday comparison), ' +
    'summary (string: one plain sentence), probable_root_cause (string: plain words), ' +
    'severity ("low"|"medium"|"high"|"critical"), confidence (number 0 to 1), evidence (list of short plain strings), ' +
    'recommended_actions (list of short concrete steps a beginner could follow), ' +
    'estimated_wasted_resources (string, say it is an estimate), additional_investigation (list of strings).\n\n' +
    'INCIDENT DATA:\n' + JSON.stringify(clean(incident), null, 2)
  );
}

function oraclePrompt(question: string, context: unknown) {
  return (
    "You are 'the Oracle' inside TokenShield, a tool that watches AI agents (called 'heroes') and stops them " +
    "when they loop or waste money. Problems are called 'perils'. This is a demo with simulated agents.\n" +
    'Answer the question using ONLY the data below.\n' + PLAIN_RULES +
    '- Keep the answer under 90 words. Lead with the direct answer.\n' +
    '- If the data cannot answer the question, say so simply and suggest what to check.\n' +
    'Respond with a JSON object: answer (string), key_points (list of up to 3 short strings), next_step (string, or empty).\n\n' +
    'QUESTION: ' + question.slice(0, 500) + '\n\nDATA:\n' + JSON.stringify(clean(context), null, 2)
  );
}

/* ---------- Gemini call ---------- */
async function callGemini(prompt: string, key: string): Promise<{ data: Record<string, unknown>; model: string }> {
  let last = 'no model answered';
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 900 },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) {
        last = `${model}: HTTP ${r.status}`;
        continue; // quota (429), retired model (404), overload (5xx): try the next model
      }
      const body = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      const json = JSON.parse(text.replace(/^```(?:json)?|```$/gm, '').trim()) as Record<string, unknown>;
      return { data: json, model };
    } catch (e) {
      last = `${model}: ${e instanceof Error ? e.name : 'error'}`;
    }
  }
  throw new Error(last);
}

const strList = (v: unknown, max = 6) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, max) : []);
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { detail: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { detail: 'Gemini is not configured on this deployment' });

  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  if (!allowed(ip)) return json(429, { detail: 'Too many Gemini requests, please wait a minute' });

  let body: { kind?: string; question?: string; context?: unknown; incident?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > 20_000) return json(413, { detail: 'Request too large' });
    body = JSON.parse(raw);
  } catch {
    return json(400, { detail: 'Invalid JSON' });
  }

  try {
    if (body.kind === 'oracle' && typeof body.question === 'string' && body.question.trim()) {
      const { data, model } = await callGemini(oraclePrompt(body.question, body.context ?? {}), key);
      return json(200, {
        answer: String(data.answer ?? '').trim(),
        key_points: strList(data.key_points, 3),
        next_step: String(data.next_step ?? ''),
        source: 'gemini',
        model,
      });
    }
    if (body.kind === 'analyze' && body.incident && typeof body.incident === 'object') {
      const { data, model } = await callGemini(analyzePrompt(body.incident), key);
      const sev = String(data.severity ?? '').toLowerCase().trim();
      let conf = Number(data.confidence);
      if (conf > 1) conf /= 100;
      return json(200, {
        plain_explanation: String(data.plain_explanation ?? ''),
        summary: String(data.summary ?? ''),
        probable_root_cause: String(data.probable_root_cause ?? ''),
        severity: SEVERITIES.includes(sev) ? sev : 'high',
        confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.7,
        evidence: strList(data.evidence),
        recommended_actions: strList(data.recommended_actions),
        estimated_wasted_resources: String(data.estimated_wasted_resources ?? ''),
        additional_investigation: strList(data.additional_investigation),
        model,
      });
    }
    return json(400, { detail: "kind must be 'oracle' (with question) or 'analyze' (with incident)" });
  } catch (e) {
    // Quota used up / all models failed: the site falls back to built-in answers.
    return json(503, { detail: `Gemini unavailable: ${e instanceof Error ? e.message : 'error'}` });
  }
}
