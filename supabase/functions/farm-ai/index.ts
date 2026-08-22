// Supabase Edge Function: farm-ai
//
// Answers a farmer's question using their own Farm Hisab records.
//
// Security notes:
//  - The Gemini API key lives only in this function's environment.
//  - Every database read uses the CALLER's JWT, so Row Level Security decides
//    what is visible. This function never uses the service-role key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];
const MAX_QUESTION_CHARS = 1500;
const MAX_HISTORY = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function daysBetween(from: string | null, to = new Date()): number | null {
  if (!from) return null;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  return Math.round((to.getTime() - start.getTime()) / 86_400_000);
}

/** Most recent date in a list of rows, or null. */
function latest(rows: Array<Record<string, unknown>>, column: string): string | null {
  let best: string | null = null;
  for (const row of rows) {
    const value = row[column];
    if (typeof value === 'string' && (best === null || value > best)) best = value;
  }
  return best;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 500);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  let payload: { question?: unknown; history?: unknown; language?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const question = typeof payload.question === 'string' ? payload.question.trim() : '';
  if (!question) return json({ error: 'bad_request' }, 400);
  if (question.length > MAX_QUESTION_CHARS) return json({ error: 'question_too_long' }, 400);

  const language = payload.language === 'gu' ? 'gu' : 'en';
  const history: ChatMessage[] = Array.isArray(payload.history)
    ? (payload.history as ChatMessage[])
        .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string')
        .slice(-MAX_HISTORY)
    : [];

  // RLS-scoped client: the caller can only ever read their own household.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'unauthorized' }, 401);

  let context: string;
  try {
    context = await buildFarmContext(supabase);
  } catch (error) {
    console.error('context_failed', error);
    return json({ error: 'context_failed' }, 500);
  }

  const systemPrompt = buildSystemPrompt(language, context);

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [
      ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      { role: 'user', parts: [{ text: question }] },
    ],
    generationConfig: { temperature: 0.4, maxOutputTokens: 1200, topP: 0.9 },
  });

  let lastDetail = '';

  // Model names move around; try the current ones in order.
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          // Newer AI Studio keys (the "AQ." format) must be sent as a header.
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body,
        },
      );

      if (!response.ok) {
        lastDetail = `${model}: ${response.status} ${(await response.text()).slice(0, 400)}`;
        console.error('gemini_error', lastDetail);
        // Only a missing/blocked model is worth retrying with another name.
        if (response.status === 404 || response.status === 400) continue;
        return json({ error: 'ai_failed', detail: lastDetail }, 502);
      }

      const result = await response.json();
      const answer: string =
        result?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

      if (!answer.trim()) {
        lastDetail = `${model}: empty response ${JSON.stringify(result).slice(0, 300)}`;
        continue;
      }
      return json({ answer });
    } catch (error) {
      lastDetail = `${model}: ${error instanceof Error ? error.message : String(error)}`;
      console.error('ai_request_failed', lastDetail);
    }
  }

  return json({ error: 'ai_failed', detail: lastDetail }, 502);
});

function buildSystemPrompt(language: 'en' | 'gu', context: string): string {
  const languageRule =
    language === 'gu'
      ? 'Reply ONLY in simple Gujarati (ગુજરાતી). Use everyday village words, not textbook language.'
      : 'Reply ONLY in simple English. Short sentences a farmer can read quickly.';

  return `You are "Farm Hisab Assistant", an experienced agronomy advisor for small family farms in Gujarat, India.

${languageRule}

HOW TO ANSWER
- Always ground your answer in the farmer's own records below. Refer to real crops, farms and dates ("your Magfali on Nani Vadi, sown 62 days ago").
- If a record explains the problem (e.g. no irrigation for 20 days, no fertilizer since sowing, a spray overdue), say so directly.
- Give 2-4 concrete next steps, ordered by what to do first.
- Keep it under 220 words. Use short bullet lines starting with "- ".
- If several causes are possible, list the most likely first and say what to check in the field to confirm.
- Prefer locally available, low-cost remedies.

SAFETY
- You may name common product categories (e.g. urea, NPK, sulphur, neem oil, a fungicide) but for exact chemical doses tell the farmer to confirm with the label or the local Krushi Vigyan Kendra / agri dealer.
- Never advise anything unsafe for people, animals or the soil.
- If the records do not contain enough information, say what is missing and ask one short follow-up question.
- If asked something unrelated to farming, politely steer back to the farm.

FARMER'S RECORDS
${context}`;
}

/** Summarises the signed-in household's records into a compact briefing. */
async function buildFarmContext(supabase: ReturnType<typeof createClient>): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`Today's date: ${today}`];

  const [settingsRes, seasonsRes, farmsRes, cropsRes] = await Promise.all([
    supabase.from('household_settings').select('currency, default_area_unit, default_weight_unit').limit(1),
    supabase.from('seasons').select('id, name, year, status, start_date, end_date').is('deleted_at', null),
    supabase.from('farms').select('id, name, local_name, area, area_unit, acre_equivalent').is('deleted_at', null),
    supabase.from('crops').select('id, name, name_gu, category').is('deleted_at', null),
  ]);

  const settings = settingsRes.data?.[0] as Record<string, string> | undefined;
  const seasons = (seasonsRes.data ?? []) as Array<Record<string, string>>;
  const farms = (farmsRes.data ?? []) as Array<Record<string, string | number>>;
  const crops = (cropsRes.data ?? []) as Array<Record<string, string>>;

  if (settings) {
    lines.push(`Units: area in ${settings.default_area_unit}, weight in ${settings.default_weight_unit}. Currency ${settings.currency}.`);
  }

  const season = seasons.find((s) => s.status === 'active') ?? seasons[seasons.length - 1];
  if (!season) return `${lines.join('\n')}\n\nThe farmer has not created any season yet, so there are no crop records.`;

  lines.push(`Current season: ${season.name} (${season.year}), status ${season.status}.`);

  const farmName = new Map(farms.map((f) => [String(f.id), String(f.name)]));
  const cropName = new Map(crops.map((c) => [c.id, c.name_gu ? `${c.name} (${c.name_gu})` : c.name]));

  lines.push(`Farms: ${farms.map((f) => `${f.name} - ${f.area} ${f.area_unit}`).join('; ') || 'none'}`);

  const { data: allocData } = await supabase
    .from('farm_crop_allocations')
    .select('id, farm_id, crop_id, area, area_unit, sowing_date, expected_harvest_date, status')
    .eq('season_id', season.id)
    .is('deleted_at', null);
  const allocations = (allocData ?? []) as Array<Record<string, string | number>>;

  if (allocations.length === 0) {
    lines.push('No crops have been planted in this season yet.');
    return lines.join('\n');
  }

  // Per-crop operational history is what makes the advice specific.
  const [irrigation, sprays, fertilizer, harvests, activities] = await Promise.all([
    supabase.from('irrigation_records').select('allocation_id, farm_id, date, water_source, hours').eq('season_id', season.id).is('deleted_at', null),
    supabase.from('spray_records').select('allocation_id, farm_id, crop_id, date, product_name, purpose, spray_number').eq('season_id', season.id).is('deleted_at', null),
    supabase.from('fertilizer_records').select('allocation_id, farm_id, date, product_name, quantity, unit').eq('season_id', season.id).is('deleted_at', null),
    supabase.from('harvests').select('allocation_id, farm_id, start_date, quantity, unit, quality').eq('season_id', season.id).is('deleted_at', null),
    supabase.from('activities').select('allocation_id, farm_id, date, activity_type, description').eq('season_id', season.id).is('deleted_at', null),
  ]);

  const byAllocation = <T extends { allocation_id?: unknown }>(rows: T[] | null, id: string): T[] =>
    (rows ?? []).filter((r) => String(r.allocation_id ?? '') === id);

  lines.push('\nCROP PLANS AND THEIR HISTORY:');

  for (const allocation of allocations) {
    const id = String(allocation.id);
    const sownDays = daysBetween(allocation.sowing_date ? String(allocation.sowing_date) : null);
    const header =
      `- ${cropName.get(String(allocation.crop_id)) ?? 'Unknown crop'} on ${farmName.get(String(allocation.farm_id)) ?? 'unknown farm'} ` +
      `(${allocation.area} ${allocation.area_unit}, status ${allocation.status}` +
      (sownDays !== null ? `, sown ${sownDays} days ago on ${allocation.sowing_date}` : ', sowing date not recorded') +
      ')';
    lines.push(header);

    const irr = byAllocation(irrigation.data as Array<Record<string, string>> | null, id);
    const lastIrr = latest(irr, 'date');
    lines.push(
      `    Irrigation: ${irr.length} times` +
        (lastIrr ? `, last ${daysBetween(lastIrr)} days ago (${lastIrr})` : ', none recorded'),
    );

    const spr = byAllocation(sprays.data as Array<Record<string, string>> | null, id);
    const lastSpray = latest(spr, 'date');
    const sprayNames = spr.slice(-3).map((s) => `${s.product_name} for ${s.purpose} on ${s.date}`);
    lines.push(
      `    Sprays: ${spr.length} times` +
        (lastSpray ? `, last ${daysBetween(lastSpray)} days ago. Recent: ${sprayNames.join('; ')}` : ', none recorded'),
    );

    const fert = byAllocation(fertilizer.data as Array<Record<string, string>> | null, id);
    const lastFert = latest(fert, 'date');
    const fertNames = fert.slice(-3).map((f) => `${f.product_name} ${f.quantity}${f.unit} on ${f.date}`);
    lines.push(
      `    Fertilizer: ${fert.length} times` +
        (lastFert ? `, last ${daysBetween(lastFert)} days ago. Recent: ${fertNames.join('; ')}` : ', none recorded'),
    );

    const har = byAllocation(harvests.data as Array<Record<string, string>> | null, id);
    if (har.length > 0) {
      lines.push(`    Harvest: ${har.map((h) => `${h.quantity} ${h.unit} (${h.quality}) on ${h.start_date}`).join('; ')}`);
    }

    const act = byAllocation(activities.data as Array<Record<string, string>> | null, id);
    if (act.length > 0) {
      lines.push(`    Recent work: ${act.slice(-4).map((a) => `${a.activity_type} on ${a.date}`).join('; ')}`);
    }
  }

  return lines.join('\n');
}
