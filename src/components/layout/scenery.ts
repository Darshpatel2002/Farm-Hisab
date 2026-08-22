/**
 * Scenic artwork rendered as inline SVG data URIs.
 *
 * These replace photographic assets: nothing is downloaded, the app still works
 * offline, and the illustration stays sharp at any screen size or zoom.
 */

function dataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`;
}

/** Plough furrows converging towards the horizon, giving the field depth. */
function furrows(vanishX: number, vanishY: number, baseY: number, count: number): string {
  const lines: string[] = [];
  for (let i = 0; i <= count; i += 1) {
    const x = (i / count) * 1600 - 200;
    lines.push(`M${x} ${baseY} L${vanishX} ${vanishY}`);
  }
  return `<path d='${lines.join(' ')}' stroke='#ffffff' stroke-opacity='0.30' stroke-width='2' fill='none'/>`;
}

/** Rolling crop rows following the land contour. */
function contours(baseY: number, rows: number): string {
  const paths: string[] = [];
  for (let i = 0; i < rows; i += 1) {
    const y = baseY + i * 16;
    const amp = 8 + i * 1.5;
    paths.push(
      `<path d='M-50 ${y} Q 300 ${y - amp} 600 ${y} T 1250 ${y}' stroke='#ffffff' stroke-opacity='${(0.10 + i * 0.02).toFixed(3)}' stroke-width='2.5' fill='none'/>`,
    );
  }
  return paths.join('');
}

/**
 * Wide farmland vista: dusk sky, sun, treeline and a ploughed field.
 * Used behind page headers and hero panels underneath a brand-green wash.
 */
export const FARM_SCENE = dataUri(`
<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='420' viewBox='0 0 1200 420' preserveAspectRatio='xMidYMid slice'>
  <defs>
    <linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#0b3f5c'/>
      <stop offset='38%' stop-color='#2c7f7a'/>
      <stop offset='72%' stop-color='#7cc08a'/>
      <stop offset='100%' stop-color='#f6d97a'/>
    </linearGradient>
    <radialGradient id='sun' cx='0.5' cy='0.5' r='0.5'>
      <stop offset='0%' stop-color='#fffdf0' stop-opacity='1'/>
      <stop offset='35%' stop-color='#ffd977' stop-opacity='0.75'/>
      <stop offset='100%' stop-color='#ffc94d' stop-opacity='0'/>
    </radialGradient>
    <linearGradient id='field' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#5cb85c'/>
      <stop offset='55%' stop-color='#2f8f45'/>
      <stop offset='100%' stop-color='#12482a'/>
    </linearGradient>
  </defs>

  <rect width='1200' height='420' fill='url(#sky)'/>
  <circle cx='880' cy='168' r='210' fill='url(#sun)'/>
  <circle cx='880' cy='168' r='42' fill='#fffdf0' fill-opacity='0.98'/>

  <g fill='#ffffff' fill-opacity='0.20'>
    <ellipse cx='220' cy='96' rx='120' ry='22'/>
    <ellipse cx='305' cy='80' rx='78' ry='16'/>
    <ellipse cx='1010' cy='68' rx='140' ry='20'/>
    <ellipse cx='600' cy='118' rx='96' ry='16'/>
  </g>

  <path d='M0 232 q 60 -26 120 -6 q 50 -30 110 -8 q 70 -34 140 -4 q 60 -26 130 -2 q 70 -30 150 -4 q 80 -26 160 -2 q 90 -22 190 2 v 30 H0 Z'
        fill='#0d3b2a' fill-opacity='0.95'/>

  <rect y='248' width='1200' height='172' fill='url(#field)'/>
  ${furrows(600, 250, 430, 22)}
  ${contours(268, 8)}

  <g stroke='#0d3b2a' stroke-opacity='0.75' stroke-width='3' fill='none'>
    <path d='M150 246 v-36'/><path d='M420 244 v-28'/><path d='M760 246 v-32'/><path d='M1060 244 v-26'/>
  </g>
</svg>`);

/** Sprouting crop silhouette used as a decorative strip along the page bottom. */
export const FIELD_STRIP = dataUri(`
<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='150' viewBox='0 0 1200 150' preserveAspectRatio='xMidYMax slice'>
  <path d='M0 96 q 70 -22 140 -4 q 70 -24 145 -2 q 75 -26 150 -4 q 70 -22 145 -2 q 75 -24 150 -2 q 80 -20 160 0 q 70 16 160 4 v 58 H0 Z'
        fill='#245e2b' fill-opacity='0.20'/>
  <path d='M0 118 q 90 -18 180 -2 q 85 -20 170 -2 q 90 -18 180 0 q 85 -16 170 0 q 90 -14 180 2 q 70 12 140 2 v 32 H0 Z'
        fill='#1f4b25' fill-opacity='0.26'/>
</svg>`);
