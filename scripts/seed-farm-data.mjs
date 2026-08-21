// Seeds one realistic finished season into a live Farm Hisab account.
// Credentials come from .env (FARM_EMAIL / FARM_PASSWORD) - never hard-code them.
//   node scripts/seed-farm-data.mjs --inspect   -> only report what already exists
//   node scripts/seed-farm-data.mjs             -> create the season
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const inspectOnly = process.argv.includes('--inspect');
const verifyOnly = process.argv.includes('--verify');

const money = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

// Rates supplied by the farm owner: price per Man (20 kg) and yield per vigha.
const CROPS = [
  {
    key: 'magafali', name: 'Magafali', gu: 'મગફળી', category: 'oilseed',
    ratePerMan: 1500, manPerVigha: 30,
    sow: '2025-06-20', landPrep: '2025-06-05', harvest: '2025-10-15', sale: '2025-10-25',
    seedCost: 4500, fertCost: 3500, irrigations: 5, sprays: 3, weedCost: 1500, harvestCost: 2500,
    seedQtyKgPerVigha: 22, variety: 'GG-20',
  },
  {
    key: 'kapas', name: 'Kapas', gu: 'કપાસ', category: 'cash_crop',
    ratePerMan: 1700, manPerVigha: 20,
    sow: '2025-06-10', landPrep: '2025-05-28', harvest: '2025-11-20', sale: '2025-11-30',
    seedCost: 2200, fertCost: 3200, irrigations: 6, sprays: 5, weedCost: 1800, harvestCost: 3500,
    seedQtyKgPerVigha: 2, variety: 'BT Hybrid',
  },
  {
    key: 'divela', name: 'Divela', gu: 'એરંડા', category: 'oilseed',
    ratePerMan: 1400, manPerVigha: 40,
    sow: '2025-07-05', landPrep: '2025-06-25', harvest: '2026-01-20', sale: '2026-01-30',
    seedCost: 900, fertCost: 2800, irrigations: 5, sprays: 2, weedCost: 1200, harvestCost: 2000,
    seedQtyKgPerVigha: 3, variety: 'GCH-7',
  },
  {
    key: 'tamaku', name: 'Tamaku', gu: 'તમાકુ', category: 'cash_crop',
    ratePerMan: 2000, manPerVigha: 35,
    sow: '2025-08-25', landPrep: '2025-08-10', harvest: '2026-02-15', sale: '2026-02-28',
    seedCost: 1200, fertCost: 5000, irrigations: 7, sprays: 4, weedCost: 2500, harvestCost: 5000,
    seedQtyKgPerVigha: 1, variety: 'Anand-119',
  },
  {
    key: 'ghau', name: 'Ghau', gu: 'ઘઉં', category: 'cereal',
    ratePerMan: 550, manPerVigha: 60,
    sow: '2025-11-20', landPrep: '2025-11-10', harvest: '2026-03-25', sale: '2026-04-05',
    seedCost: 1600, fertCost: 3000, irrigations: 5, sprays: 1, weedCost: 1000, harvestCost: 1800,
    seedQtyKgPerVigha: 50, variety: 'Lok-1',
  },
];

const FARMS = [
  { name: 'Hirabhavaru Khetar', local: 'હીરાભાવારુ ખેતર', vigha: 5, crop: 'magafali' },
  { name: 'Maar', local: 'માર', vigha: 4, crop: 'kapas' },
  { name: 'Maga Varu', local: 'મગા વારુ', vigha: 3, crop: 'divela' },
  { name: 'Vadivala Khetar', local: 'વાડીવાળા ખેતર', vigha: 6, crop: 'tamaku' },
  { name: 'Nava Khetar', local: 'નવા ખેતર', vigha: 8, crop: 'ghau' },
];

const PER_VIGHA = { landPrep: 1500, sowing: 800, irrigation: 450, spray: 700, transport: 400 };
const SHARED_TRACTOR = 12000;
const SEASON_NAME = '2025-26 Season';

const addDays = (iso, days) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

async function insert(table, values) {
  const { data, error } = await supabase.from(table).insert(values).select().single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function main() {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: env.FARM_EMAIL,
    password: env.FARM_PASSWORD,
  });
  if (signInError) throw new Error(`Sign in failed: ${signInError.message}`);

  const { data: profiles } = await supabase.from('profiles').select('*');
  const household = profiles[0].household_id;
  console.log(`Signed in as ${env.FARM_EMAIL} (role: ${profiles[0].role})`);

  const [farms, crops, seasons, expenses, sales] = await Promise.all([
    supabase.from('farms').select('id,name').is('deleted_at', null),
    supabase.from('crops').select('id,name').is('deleted_at', null),
    supabase.from('seasons').select('id,name').is('deleted_at', null),
    supabase.from('expenses').select('id').is('deleted_at', null),
    supabase.from('sales').select('id').is('deleted_at', null),
  ]);

  console.log('\nExisting data in this account:');
  console.log(`  farms    : ${farms.data.length}${farms.data.length ? ' -> ' + farms.data.map((f) => f.name).join(', ') : ''}`);
  console.log(`  crops    : ${crops.data.length}${crops.data.length ? ' -> ' + crops.data.map((c) => c.name).join(', ') : ''}`);
  console.log(`  seasons  : ${seasons.data.length}${seasons.data.length ? ' -> ' + seasons.data.map((s) => s.name).join(', ') : ''}`);
  console.log(`  expenses : ${expenses.data.length}`);
  console.log(`  sales    : ${sales.data.length}`);

  if (inspectOnly) return;

  if (verifyOnly) {
    const seasonRow = seasons.data.find((s) => s.name === SEASON_NAME);
    if (!seasonRow) throw new Error(`"${SEASON_NAME}" not found`);
    const sid = seasonRow.id;

    const [exp, sal, har, alloc, farmRows, cropRows, shares] = await Promise.all([
      supabase.from('expenses').select('*').eq('season_id', sid).is('deleted_at', null),
      supabase.from('sales').select('*').eq('season_id', sid).is('deleted_at', null),
      supabase.from('harvests').select('*').eq('season_id', sid).is('deleted_at', null),
      supabase.from('farm_crop_allocations').select('*').eq('season_id', sid).is('deleted_at', null),
      supabase.from('farms').select('*').is('deleted_at', null),
      supabase.from('crops').select('*').is('deleted_at', null),
      supabase.from('expense_allocations').select('*'),
    ]);

    const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
    const expIds = new Set(exp.data.map((e) => e.id));
    const myShares = shares.data.filter((s) => expIds.has(s.expense_id));

    const totalCost = sum(exp.data, 'amount');
    const allocated = sum(myShares, 'amount');
    const revenue = sum(sal.data, 'net_amount');

    console.log(`\nVerifying "${SEASON_NAME}" from the database\n`);
    console.log(`  expense rows      : ${exp.data.length}`);
    const bySource = {};
    for (const e of exp.data) bySource[e.source_type] = (bySource[e.source_type] ?? 0) + 1;
    console.log(`  by source         : ${JSON.stringify(bySource)}`);
    console.log(`  total cost        : ${money(totalCost)}`);
    console.log(`  allocated to farms: ${money(allocated)}`);
    console.log(`  unallocated       : ${money(totalCost - allocated)}`);
    console.log(`  total income      : ${money(revenue)}`);
    console.log(`  net profit        : ${money(revenue - totalCost)}`);
    console.log(`  ROI               : ${((revenue - totalCost) / totalCost * 100).toFixed(1)}%`);

    console.log('\nPer farm (cost from expense_allocations, income from sales):');
    for (const a of alloc.data) {
      const farm = farmRows.data.find((f) => f.id === a.farm_id);
      const crop = cropRows.data.find((c) => c.id === a.crop_id);
      const cost = sum(myShares.filter((s) => s.farm_id === a.farm_id), 'amount');
      const income = sum(sal.data.filter((s) => s.farm_id === a.farm_id), 'net_amount');
      const qty = sum(har.data.filter((h) => h.farm_id === a.farm_id), 'net_quantity');
      const acres = Number(a.acre_equivalent);
      console.log(
        `  ${(farm?.name ?? '').padEnd(22)}${(crop?.name ?? '').padEnd(10)}` +
        `${(a.area + ' vigha').padStart(9)}  cost ${money(cost).padStart(10)}  income ${money(income).padStart(11)}` +
        `  profit ${money(income - cost).padStart(11)}  /acre ${money((income - cost) / acres).padStart(10)}  ${qty} man`,
      );
    }
    return;
  }

  if (seasons.data.some((s) => s.name === SEASON_NAME)) {
    throw new Error(`"${SEASON_NAME}" already exists. Delete it first (Settings -> Delete data) to reseed.`);
  }

  const { data: units } = await supabase.from('units').select('*');
  const factor = (kind, code) => Number(units.find((u) => u.kind === kind && u.code === code)?.factor_to_base ?? 1);
  const vighaToAcre = factor('area', 'vigha');

  const season = await insert('seasons', {
    household_id: household,
    name: SEASON_NAME,
    year: 2025,
    start_date: '2025-06-01',
    end_date: '2026-04-30',
    status: 'completed',
    notes: 'Full season: Kharif and Rabi crops',
  });

  const cropIds = {};
  for (const crop of CROPS) {
    // Reuse a crop the owner already created rather than making a near-duplicate.
    const existing = crops.data.find((c) => c.name.trim().toLowerCase() === crop.name.toLowerCase());
    if (existing) {
      cropIds[crop.key] = existing.id;
      await supabase.from('crops').update({ name_gu: crop.gu, default_unit: 'man' }).eq('id', existing.id);
      console.log(`  reusing existing crop "${existing.name}"`);
      continue;
    }
    const row = await insert('crops', {
      household_id: household,
      name: crop.name,
      name_gu: crop.gu,
      category: crop.category,
      default_unit: 'man',
    });
    cropIds[crop.key] = row.id;
  }

  const summary = [];
  const farmIds = [];

  for (const farm of FARMS) {
    const crop = CROPS.find((c) => c.key === farm.crop);
    const acres = Number((farm.vigha * vighaToAcre).toFixed(4));

    const farmRow = await insert('farms', {
      household_id: household,
      name: farm.name,
      local_name: farm.local,
      area: farm.vigha,
      area_unit: 'vigha',
      acre_equivalent: acres,
      location_notes: 'Kadoli, Himatnagar',
    });
    farmIds.push({ id: farmRow.id, acres, name: farm.name });

    const alloc = await insert('farm_crop_allocations', {
      household_id: household,
      farm_id: farmRow.id,
      season_id: season.id,
      crop_id: cropIds[crop.key],
      area: farm.vigha,
      area_unit: 'vigha',
      acre_equivalent: acres,
      land_prep_date: crop.landPrep,
      sowing_date: crop.sow,
      germination_date: addDays(crop.sow, 8),
      expected_harvest_date: crop.harvest,
      actual_harvest_date: crop.harvest,
      status: 'sold',
    });

    const base = { household_id: household, season_id: season.id, farm_id: farmRow.id, allocation_id: alloc.id };
    const v = farm.vigha;
    let cost = 0;

    await insert('activities', {
      ...base, date: crop.landPrep, activity_type: 'land_preparation',
      description: 'Ploughing and rotavator', cost: PER_VIGHA.landPrep * v, tractor_hours: v * 1.5,
      vendor: 'Tractor owner',
    });
    cost += PER_VIGHA.landPrep * v;

    await insert('seed_records', {
      ...base, crop_id: cropIds[crop.key], date: crop.sow, variety: crop.variety,
      quantity: crop.seedQtyKgPerVigha * v, unit: 'kg',
      price_per_unit: Number(((crop.seedCost * v) / (crop.seedQtyKgPerVigha * v)).toFixed(2)),
      supplier: 'Kadoli Krushi Kendra',
    });
    cost += crop.seedCost * v;

    await insert('activities', {
      ...base, date: crop.sow, activity_type: 'sowing', description: 'Sowing labour',
      cost: PER_VIGHA.sowing * v, labour_days: v * 2,
    });
    cost += PER_VIGHA.sowing * v;

    await insert('fertilizer_records', {
      ...base, date: addDays(crop.sow, 15), product_name: 'DAP + Urea',
      quantity: 50 * v, unit: 'kg', rate: Number((crop.fertCost / 50).toFixed(2)),
      material_cost: crop.fertCost * v, labour_cost: 200 * v,
    });
    cost += crop.fertCost * v + 200 * v;

    for (let i = 1; i <= crop.irrigations; i++) {
      await insert('irrigation_records', {
        ...base, date: addDays(crop.sow, i * 18), irrigation_number: i,
        water_source: i % 3 === 0 ? 'canal' : 'borewell', hours: v * 2, cost: PER_VIGHA.irrigation * v,
      });
      cost += PER_VIGHA.irrigation * v;
    }

    for (let i = 1; i <= crop.sprays; i++) {
      await insert('spray_records', {
        ...base, crop_id: cropIds[crop.key], scope: 'farm', date: addDays(crop.sow, 25 + i * 20),
        spray_number: i, product_name: `Medicine ${i}`,
        purpose: i === 1 ? 'insecticide' : i === 2 ? 'fungicide' : 'pesticide',
        quantity: 250 * v, unit: 'ml', rate: 2,
        material_cost: PER_VIGHA.spray * v * 0.7, labour_cost: PER_VIGHA.spray * v * 0.3, application_cost: 0,
      });
      cost += PER_VIGHA.spray * v;
    }

    await insert('activities', {
      ...base, date: addDays(crop.sow, 40), activity_type: 'weed_control',
      description: 'Weeding labour', cost: crop.weedCost * v, labour_days: v * 3,
    });
    cost += crop.weedCost * v;

    const totalMan = crop.manPerVigha * v;
    const wastage = Number((totalMan * 0.02).toFixed(2));
    await insert('harvests', {
      ...base, crop_id: cropIds[crop.key], start_date: crop.harvest, end_date: addDays(crop.harvest, 5),
      quantity: totalMan, unit: 'man', quality: 'a', wastage,
      labour_cost: crop.harvestCost * v * 0.6, harvest_cost: crop.harvestCost * v * 0.4,
      transport_cost: PER_VIGHA.transport * v,
    });
    cost += crop.harvestCost * v + PER_VIGHA.transport * v;

    const soldMan = Number((totalMan - wastage).toFixed(2));
    const gross = soldMan * crop.ratePerMan;
    const commission = Math.round(gross * 0.01);
    const transport = 250 * v;
    const pending = crop.key === 'tamaku';
    await insert('sales', {
      ...base, crop_id: cropIds[crop.key], date: crop.sale,
      buyer: v % 2 === 0 ? 'Himatnagar APMC' : 'Local trader',
      quantity: soldMan, unit: 'man', price_per_unit: crop.ratePerMan,
      transport_cost: transport, commission, other_deductions: 0,
      payment_status: pending ? 'pending' : 'received',
      amount_received: 0,
    });

    const net = gross - transport - commission;
    summary.push({ farm: farm.name, crop: crop.name, vigha: v, cost, revenue: net, profit: net - cost });
  }

  // One genuinely shared expense, split across all five farms by area.
  const sharedExpense = await insert('expenses', {
    household_id: household, season_id: season.id, date: '2025-06-01', category: 'tractor',
    description: 'Shared JCB and land levelling for all farms', amount: SHARED_TRACTOR,
    allocation_method: 'area', payment_method: 'cash', vendor: 'JCB contractor',
  });
  const totalAcres = farmIds.reduce((s, f) => s + f.acres, 0);
  let running = 0;
  for (let i = 0; i < farmIds.length; i++) {
    const last = i === farmIds.length - 1;
    const share = last
      ? Number((SHARED_TRACTOR - running).toFixed(2))
      : Number(((SHARED_TRACTOR * farmIds[i].acres) / totalAcres).toFixed(2));
    running = Number((running + share).toFixed(2));
    const { error } = await supabase.from('expense_allocations').insert({
      household_id: household, expense_id: sharedExpense.id, farm_id: farmIds[i].id,
      amount: share, basis: 'area',
    });
    if (error) throw new Error(`expense_allocations: ${error.message}`);
  }

  await supabase.from('household_settings').update({ default_season_id: season.id }).eq('household_id', household);

  console.log(`\nCreated season "${SEASON_NAME}"\n`);
  console.log('Farm                  Crop                   Vigha        Cost       Income      Profit');
  let tc = 0, tr = 0;
  for (const r of summary) {
    tc += r.cost; tr += r.revenue;
    console.log(
      `${r.farm.padEnd(22)}${r.crop.padEnd(23)}${String(r.vigha).padStart(5)}${money(r.cost).padStart(12)}${money(r.revenue).padStart(13)}${money(r.profit).padStart(12)}`,
    );
  }
  console.log(`\nShared JCB expense (split by area): ${money(SHARED_TRACTOR)}`);
  console.log(`TOTAL cost ${money(tc + SHARED_TRACTOR)} | income ${money(tr)} | profit ${money(tr - tc - SHARED_TRACTOR)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nFAILED:', error.message);
    process.exit(1);
  });
