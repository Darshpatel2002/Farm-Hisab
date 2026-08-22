// Supabase Edge Function: farm-ai
//
// Answers a farmer's question using their own Farm Hisab records.
//
// Security notes:
//  - The Gemini API key lives only in this function's environment.
//  - Every database read forwards the CALLER's JWT to PostgREST, so Row Level
//    Security decides what is visible. The service-role key is never used.
//  - No third-party imports: plain fetch only, so the function cannot fail to boot.

// Google retires model names periodically; the first that responds is used.
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
const MAX_QUESTION_CHARS = 1500;
const MAX_HISTORY = 10;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  // x-application-name is added by the app's Supabase client on every request.
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-application-name, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

type Row = Record<string, unknown>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function daysSince(from: string | null): number | null {
  if (!from) return null;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  return Math.round((Date.now() - start.getTime()) / 86_400_000);
}

function latest(rows: Row[], column: string): string | null {
  let best: string | null = null;
  for (const row of rows) {
    const value = row[column];
    if (typeof value === 'string' && (best === null || value > best)) best = value;
  }
  return best;
}

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 500);
  if (!supabaseUrl || !anonKey) return json({ error: 'not_configured', detail: 'missing supabase env' }, 500);

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

  const authHeaders = { Authorization: authHeader, apikey: anonKey };

  // Confirm the caller is a real signed-in user before touching any data.
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: authHeaders });
  if (!userResponse.ok) return json({ error: 'unauthorized' }, 401);

  /** Reads a table through PostgREST under the caller's RLS policies. */
  async function select(table: string, query: string): Promise<Row[]> {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers: authHeaders });
    if (!response.ok) return [];
    return (await response.json()) as Row[];
  }

  let context: string;
  try {
    context = await buildFarmContext(select);
  } catch (error) {
    return json({ error: 'context_failed', detail: error instanceof Error ? error.message : String(error) }, 500);
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: buildSystemPrompt(language, context) }] },
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
        lastDetail = `${model}: ${response.status} ${(await response.text()).slice(0, 300)}`;
        if (response.status === 404 || response.status === 400) continue;
        return json({ error: 'ai_failed', detail: lastDetail }, 502);
      }

      const result = await response.json();
      const parts = result?.candidates?.[0]?.content?.parts as Array<{ text?: string }> | undefined;
      const answer = (parts ?? []).map((p) => p.text ?? '').join('').trim();

      if (!answer) {
        lastDetail = `${model}: empty ${JSON.stringify(result).slice(0, 250)}`;
        continue;
      }
      return json({ answer });
    } catch (error) {
      lastDetail = `${model}: ${error instanceof Error ? error.message : String(error)}`;
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
- If a record explains the problem (no irrigation for 20 days, no fertilizer since sowing, a spray overdue), say so directly.
- Give 2-4 concrete next steps, ordered by what to do first.
- Keep it under 220 words. Use short bullet lines starting with "- ".
- If several causes are possible, list the most likely first and say what to check in the field to confirm.
- Prefer locally available, low-cost remedies.

SAFETY
- You may name common product categories (urea, NPK, sulphur, neem oil, a fungicide) but for exact chemical doses tell the farmer to confirm with the label or the local Krushi Vigyan Kendra / agri dealer.
- Never advise anything unsafe for people, animals or the soil.
- If the records do not contain enough information, say what is missing and ask one short follow-up question.
- If asked something unrelated to farming, politely steer back to the farm.

FARMER'S RECORDS
${context}`;
}

/** Summarises the signed-in household's records into a compact briefing. */
async function buildFarmContext(select: (table: string, query: string) => Promise<Row[]>): Promise<string> {
  const lines: string[] = [`Today's date: ${new Date().toISOString().slice(0, 10)}`];

  const [settingsRows, seasons, farms, crops] = await Promise.all([
    select('household_settings', 'select=currency,default_area_unit,default_weight_unit&limit=1'),
    select('seasons', 'select=id,name,year,status,start_date,end_date&deleted_at=is.null'),
    select('farms', 'select=id,name,local_name,area,area_unit&deleted_at=is.null'),
    select('crops', 'select=id,name,name_gu&deleted_at=is.null'),
  ]);

  const settings = settingsRows[0];
  if (settings) {
    lines.push(
      `Units: area in ${str(settings.default_area_unit)}, weight in ${str(settings.default_weight_unit)}. Currency ${str(settings.currency)}.`,
    );
  }

  const season = seasons.find((s) => s.status === 'active') ?? seasons[seasons.length - 1];
  if (!season) return `${lines.join('\n')}\n\nThe farmer has not created any season yet, so there are no crop records.`;

  lines.push(`Current season: ${str(season.name)} (${str(season.year)}), status ${str(season.status)}.`);

  const farmName = new Map(farms.map((f) => [str(f.id), str(f.name)]));
  const cropName = new Map(crops.map((c) => [str(c.id), c.name_gu ? `${str(c.name)} (${str(c.name_gu)})` : str(c.name)]));

  lines.push(`Farms: ${farms.map((f) => `${str(f.name)} - ${str(f.area)} ${str(f.area_unit)}`).join('; ') || 'none'}`);

  const seasonFilter = `season_id=eq.${str(season.id)}&deleted_at=is.null`;
  const allocations = await select(
    'farm_crop_allocations',
    `select=id,farm_id,crop_id,area,area_unit,sowing_date,expected_harvest_date,status&${seasonFilter}`,
  );

  if (allocations.length === 0) {
    lines.push('No crops have been planted in this season yet.');
    return lines.join('\n');
  }

  const [irrigation, sprays, fertilizer, harvests, activities] = await Promise.all([
    select('irrigation_records', `select=allocation_id,date,water_source,hours&${seasonFilter}`),
    select('spray_records', `select=allocation_id,date,product_name,purpose,spray_number&${seasonFilter}`),
    select('fertilizer_records', `select=allocation_id,date,product_name,quantity,unit&${seasonFilter}`),
    select('harvests', `select=allocation_id,start_date,quantity,unit,quality&${seasonFilter}`),
    select('activities', `select=allocation_id,date,activity_type,description&${seasonFilter}`),
  ]);

  const forAllocation = (rows: Row[], id: string) => rows.filter((r) => str(r.allocation_id) === id);

  lines.push('\nCROP PLANS AND THEIR HISTORY:');

  for (const allocation of allocations) {
    const id = str(allocation.id);
    const sown = allocation.sowing_date ? str(allocation.sowing_date) : null;
    const age = daysSince(sown);

    lines.push(
      `- ${cropName.get(str(allocation.crop_id)) ?? 'Unknown crop'} on ${farmName.get(str(allocation.farm_id)) ?? 'unknown farm'} ` +
        `(${str(allocation.area)} ${str(allocation.area_unit)}, status ${str(allocation.status)}` +
        (age !== null ? `, sown ${age} days ago on ${sown}` : ', sowing date not recorded') +
        ')',
    );

    const irr = forAllocation(irrigation, id);
    const lastIrr = latest(irr, 'date');
    lines.push(`    Irrigation: ${irr.length} times${lastIrr ? `, last ${daysSince(lastIrr)} days ago (${lastIrr})` : ', none recorded'}`);

    const spr = forAllocation(sprays, id);
    const lastSpray = latest(spr, 'date');
    lines.push(
      `    Sprays: ${spr.length} times` +
        (lastSpray
          ? `, last ${daysSince(lastSpray)} days ago. Recent: ${spr.slice(-3).map((s) => `${str(s.product_name)} for ${str(s.purpose)} on ${str(s.date)}`).join('; ')}`
          : ', none recorded'),
    );

    const fert = forAllocation(fertilizer, id);
    const lastFert = latest(fert, 'date');
    lines.push(
      `    Fertilizer: ${fert.length} times` +
        (lastFert
          ? `, last ${daysSince(lastFert)} days ago. Recent: ${fert.slice(-3).map((f) => `${str(f.product_name)} ${str(f.quantity)}${str(f.unit)} on ${str(f.date)}`).join('; ')}`
          : ', none recorded'),
    );

    const har = forAllocation(harvests, id);
    if (har.length > 0) {
      lines.push(`    Harvest: ${har.map((h) => `${str(h.quantity)} ${str(h.unit)} (${str(h.quality)}) on ${str(h.start_date)}`).join('; ')}`);
    }

    const act = forAllocation(activities, id);
    if (act.length > 0) {
      lines.push(`    Recent work: ${act.slice(-4).map((a) => `${str(a.activity_type)} on ${str(a.date)}`).join('; ')}`);
    }
  }

  return lines.join('\n');
}
