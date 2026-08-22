/**
 * Hero artwork, one scene per module.
 *
 * Every scene is an inline SVG data URI: nothing is downloaded, it works
 * offline, stays sharp at any zoom and carries no stock-photo licensing.
 * Each composition keeps its subject on the RIGHT so the page title on the
 * left stays readable under the brand scrim.
 */

function dataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`;
}

const W = 1200;
const H = 420;

function open(defs: string): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}' preserveAspectRatio='xMidYMid slice'><defs>${defs}</defs>`;
}

/** Warm dawn sky shared by the outdoor scenes. */
const skyDawn = `
  <linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0%' stop-color='#0b3f5c'/><stop offset='38%' stop-color='#2c7f7a'/>
    <stop offset='72%' stop-color='#7cc08a'/><stop offset='100%' stop-color='#f6d97a'/>
  </linearGradient>
  <radialGradient id='sun' cx='0.5' cy='0.5' r='0.5'>
    <stop offset='0%' stop-color='#fffdf0'/><stop offset='35%' stop-color='#ffd977' stop-opacity='0.75'/>
    <stop offset='100%' stop-color='#ffc94d' stop-opacity='0'/>
  </radialGradient>
  <linearGradient id='field' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0%' stop-color='#5cb85c'/><stop offset='55%' stop-color='#2f8f45'/>
    <stop offset='100%' stop-color='#12482a'/>
  </linearGradient>`;

const sunAndClouds = `
  <circle cx='880' cy='168' r='210' fill='url(#sun)'/>
  <circle cx='880' cy='168' r='42' fill='#fffdf0' fill-opacity='0.98'/>
  <g fill='#ffffff' fill-opacity='0.18'>
    <ellipse cx='220' cy='96' rx='120' ry='22'/><ellipse cx='305' cy='80' rx='78' ry='16'/>
    <ellipse cx='1010' cy='68' rx='140' ry='20'/><ellipse cx='600' cy='118' rx='96' ry='16'/>
  </g>`;

const treeline = `<path d='M0 232 q 60 -26 120 -6 q 50 -30 110 -8 q 70 -34 140 -4 q 60 -26 130 -2 q 70 -30 150 -4 q 80 -26 160 -2 q 90 -22 190 2 v 30 H0 Z' fill='#0d3b2a' fill-opacity='0.95'/>`;

/** Plough furrows converging on the horizon. */
function furrows(count = 22): string {
  const d: string[] = [];
  for (let i = 0; i <= count; i += 1) d.push(`M${(i / count) * 1600 - 200} 430 L600 250`);
  return `<path d='${d.join(' ')}' stroke='#ffffff' stroke-opacity='0.28' stroke-width='2' fill='none'/>`;
}

/** Rolling contour rows across the field. */
function contours(baseY = 268, rows = 8): string {
  return Array.from({ length: rows }, (_, i) => {
    const y = baseY + i * 16;
    return `<path d='M-50 ${y} Q 300 ${y - (8 + i * 1.5)} 600 ${y} T 1250 ${y}' stroke='#ffffff' stroke-opacity='${(0.1 + i * 0.02).toFixed(2)}' stroke-width='2.5' fill='none'/>`;
  }).join('');
}

/** Upright crop stalks, used for close-up scenes. */
function stalks(fromX: number, toX: number, step: number, baseY: number, height: number): string {
  const parts: string[] = [];
  for (let x = fromX; x <= toX; x += step) {
    const h = height + ((x / step) % 3) * 14;
    parts.push(
      `<path d='M${x} ${baseY} V${baseY - h}' stroke='#0f4d2c' stroke-opacity='0.55' stroke-width='3'/>` +
        `<path d='M${x} ${baseY - h + 12} q -16 -12 -22 -30 q 18 2 22 22z' fill='#1c7a44' fill-opacity='0.6'/>` +
        `<path d='M${x} ${baseY - h + 24} q 16 -12 22 -30 q -18 2 -22 22z' fill='#25914f' fill-opacity='0.55'/>`,
    );
  }
  return parts.join('');
}

const OUTDOOR_BASE = `${open(skyDawn)}<rect width='${W}' height='${H}' fill='url(#sky)'/>${sunAndClouds}${treeline}<rect y='248' width='${W}' height='172' fill='url(#field)'/>`;

/** 🌅 Home - cinematic sunrise over open farmland. */
const HOME = dataUri(`${OUTDOOR_BASE}${furrows()}${contours()}
  <g stroke='#0d3b2a' stroke-opacity='0.7' stroke-width='3' fill='none'>
    <path d='M150 246 v-36'/><path d='M420 244 v-28'/><path d='M760 246 v-32'/><path d='M1060 244 v-26'/>
  </g></svg>`);

/** 🌾 Farms - wide landscape with field boundaries and a barn. */
const FARMS = dataUri(`${OUTDOOR_BASE}${furrows()}${contours()}
  <g fill='#0d3b2a' fill-opacity='0.9'>
    <path d='M900 246 v-56 l58 -34 l58 34 v56 z'/><path d='M1016 246 v-44 h56 v44 z'/>
  </g>
  <path d='M900 190 l58 -34 l58 34' fill='none' stroke='#f6d97a' stroke-opacity='0.5' stroke-width='3'/>
  </svg>`);

/** 🌱 Crops - close-up of healthy crop rows. */
const CROPS = dataUri(`${open(skyDawn)}<rect width='${W}' height='${H}' fill='url(#sky)'/>${sunAndClouds}
  <rect y='200' width='${W}' height='220' fill='url(#field)'/>
  ${contours(216, 10)}
  ${stalks(620, 1180, 46, 420, 150)}
  ${stalks(640, 1160, 46, 360, 110)}
  </svg>`);

/** 📅 Seasons - sowing, growing and harvest across the field. */
const SEASONS = dataUri(`${OUTDOOR_BASE}${contours()}
  ${stalks(700, 780, 40, 420, 60)}
  ${stalks(860, 940, 40, 420, 110)}
  ${stalks(1020, 1120, 40, 420, 160)}
  </svg>`);

/** 🚜 Activities - tractor working the field. */
const ACTIVITIES = dataUri(`${OUTDOOR_BASE}${furrows()}${contours()}
  <g fill='#0d3b2a' fill-opacity='0.92'>
    <rect x='860' y='300' width='150' height='58' rx='10'/>
    <rect x='985' y='262' width='78' height='58' rx='10'/>
    <circle cx='905' cy='372' r='42'/><circle cx='1040' cy='380' r='30'/>
  </g>
  <g fill='none' stroke='#f6d97a' stroke-opacity='0.45' stroke-width='4'>
    <circle cx='905' cy='372' r='22'/><circle cx='1040' cy='380' r='15'/>
  </g></svg>`);

/** 💧 Irrigation - sprinkler arcs over the crop. */
const IRRIGATION = dataUri(`${OUTDOOR_BASE}${contours()}
  <g stroke='#dff6ff' stroke-opacity='0.55' stroke-width='3' fill='none'>
    <path d='M960 330 q -110 -120 -240 -60'/><path d='M960 330 q -80 -140 -190 -110'/>
    <path d='M960 330 q -30 -150 -110 -160'/><path d='M960 330 q 60 -130 180 -110'/>
  </g>
  <g fill='#0d3b2a' fill-opacity='0.9'><rect x='944' y='320' width='34' height='80' rx='8'/><rect x='912' y='392' width='98' height='18' rx='9'/></g>
  <g fill='#dff6ff' fill-opacity='0.6'>
    <circle cx='700' cy='250' r='6'/><circle cx='780' cy='214' r='5'/><circle cx='860' cy='186' r='6'/><circle cx='1120' cy='226' r='5'/>
  </g></svg>`);

/** 🧴 Sprays - boom sprayer misting the crop. */
const SPRAYS = dataUri(`${OUTDOOR_BASE}${contours()}
  <g fill='#0d3b2a' fill-opacity='0.92'>
    <rect x='940' y='288' width='120' height='54' rx='10'/><circle cx='975' cy='362' r='34'/><circle cx='1075' cy='368' r='26'/>
    <rect x='700' y='300' width='250' height='10' rx='5'/>
  </g>
  <g stroke='#e9fbf1' stroke-opacity='0.45' stroke-width='2.5' fill='none'>
    <path d='M730 312 l-26 60'/><path d='M790 312 l-20 62'/><path d='M850 312 l-14 64'/><path d='M910 312 l-8 62'/>
  </g>
  <g fill='#e9fbf1' fill-opacity='0.35'>
    <ellipse cx='720' cy='386' rx='34' ry='12'/><ellipse cx='800' cy='392' rx='30' ry='11'/><ellipse cx='880' cy='390' rx='28' ry='10'/>
  </g></svg>`);

/** 🧪 Fertilizer - granules spread over prepared rows. */
const FERTILIZER = dataUri(`${OUTDOOR_BASE}${furrows()}${contours()}
  <g fill='#0d3b2a' fill-opacity='0.92'><path d='M920 300 h150 l-24 66 h-102 z'/><rect x='936' y='276' width='118' height='26' rx='8'/></g>
  <g fill='#f6d97a' fill-opacity='0.6'>
    <circle cx='900' cy='386' r='5'/><circle cx='940' cy='398' r='4'/><circle cx='985' cy='390' r='5'/>
    <circle cx='1030' cy='400' r='4'/><circle cx='1070' cy='388' r='5'/><circle cx='860' cy='398' r='4'/>
  </g></svg>`);

/** 🌰 Seeds - hand sowing seed into fresh soil. */
const SEEDS = dataUri(`${open(skyDawn)}<rect width='${W}' height='${H}' fill='url(#sky)'/>${sunAndClouds}${treeline}
  <rect y='248' width='${W}' height='172' fill='#5a3f22'/>
  ${furrows()}
  <path d='M880 250 q 60 -40 130 -30 q 40 6 50 34 q -50 18 -96 12 q -50 -6 -84 -16 z' fill='#f3d9b1' fill-opacity='0.6'/>
  <g fill='#f6d97a' fill-opacity='0.75'>
    <ellipse cx='900' cy='320' rx='7' ry='10'/><ellipse cx='945' cy='352' rx='7' ry='10'/>
    <ellipse cx='990' cy='330' rx='7' ry='10'/><ellipse cx='1035' cy='368' rx='7' ry='10'/>
  </g></svg>`);

/** 🧺 Harvest - full crop ready to cut. */
const HARVEST = dataUri(`${OUTDOOR_BASE}${contours()}
  ${stalks(620, 1180, 38, 420, 170)}
  </svg>`);

/** 🏷️ Sales / 💰 Expenses - produce leaving the field to market. */
const MARKET = dataUri(`${OUTDOOR_BASE}${furrows()}${contours()}
  <g fill='#0d3b2a' fill-opacity='0.92'>
    <rect x='880' y='280' width='190' height='70' rx='10'/><circle cx='925' cy='368' r='30'/><circle cx='1030' cy='368' r='30'/>
  </g>
  <g fill='#f6d97a' fill-opacity='0.55'>
    <circle cx='920' cy='266' r='14'/><circle cx='960' cy='258' r='14'/><circle cx='1000' cy='266' r='14'/>
  </g></svg>`);

/** 📊 Reports - aerial field mosaic, deliberately analytical. */
const REPORTS = dataUri(`${open(skyDawn)}
  <rect width='${W}' height='${H}' fill='#14724a'/>
  <g fill='#ffffff'>
    <rect x='0' y='0' width='300' height='140' fill-opacity='0.06'/><rect x='300' y='0' width='260' height='140' fill-opacity='0.11'/>
    <rect x='560' y='0' width='340' height='140' fill-opacity='0.04'/><rect x='900' y='0' width='300' height='140' fill-opacity='0.09'/>
    <rect x='0' y='140' width='240' height='150' fill-opacity='0.10'/><rect x='240' y='140' width='320' height='150' fill-opacity='0.05'/>
    <rect x='560' y='140' width='280' height='150' fill-opacity='0.12'/><rect x='840' y='140' width='360' height='150' fill-opacity='0.06'/>
    <rect x='0' y='290' width='330' height='130' fill-opacity='0.05'/><rect x='330' y='290' width='250' height='130' fill-opacity='0.10'/>
    <rect x='580' y='290' width='300' height='130' fill-opacity='0.07'/><rect x='880' y='290' width='320' height='130' fill-opacity='0.12'/>
  </g>
  <g fill='#f6d97a' fill-opacity='0.5'>
    <rect x='900' y='300' width='34' height='90'/><rect x='950' y='250' width='34' height='140'/>
    <rect x='1000' y='285' width='34' height='105'/><rect x='1050' y='215' width='34' height='175'/>
  </g></svg>`);

/** ⚙️ Settings and other utility pages reuse the calm home vista. */
export const SCENES: Record<string, string> = {
  dashboard: HOME,
  farms: FARMS,
  crops: CROPS,
  seasons: SEASONS,
  activities: ACTIVITIES,
  irrigation: IRRIGATION,
  sprays: SPRAYS,
  fertilizers: FERTILIZER,
  seeds: SEEDS,
  harvest: HARVEST,
  sales: MARKET,
  expenses: MARKET,
  reports: REPORTS,
  settings: REPORTS,
  search: HOME,
  add: HOME,
  more: HOME,
};

export const FARM_SCENE = HOME;
