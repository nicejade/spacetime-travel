import { geoGraticule } from 'd3-geo';
import { transportDash } from '$lib/format';
import { countryFeatures, pathGenerator } from '$lib/geo';
import { buildRouteGeometry } from '$lib/movie/pathSampler';
import type { Leg } from '$lib/types';
import type { PlottedVisit } from '$lib/movie/types';
import {
  POSTER_HEIGHT,
  POSTER_LAYOUT,
  POSTER_WIDTH,
  type PosterBuildInput,
  type PosterStats
} from './types';

const FONT = 'Inter, ui-sans-serif, system-ui, sans-serif';
const graticule = geoGraticule().step([30, 30]);
const graticulePath = pathGenerator(graticule()) ?? '';
const spherePath = pathGenerator({ type: 'Sphere' }) ?? '';

const POSTER_STYLES = `
  .sphere { fill: #e7f0e3; stroke: rgba(35, 95, 115, 0.16); stroke-width: 1.4; }
  .graticule { fill: none; stroke: rgba(35, 95, 115, 0.13); stroke-width: 1; }
  .country { fill: rgba(255, 255, 255, 0.54); stroke: rgba(71, 103, 101, 0.2); stroke-width: 0.72; }
  .route-line { fill: none; stroke-linecap: round; stroke-width: 4; opacity: 0.78; }
  .visit-node .node-aura { opacity: 0.18; }
  .visit-node .node-core { stroke: #fff; stroke-width: 2; }
`;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRating(stats: PosterStats): string {
  return stats.averageRating === null ? '—' : String(stats.averageRating);
}

function routePath(legs: Leg[], plottedById: Map<number, PlottedVisit>, leg: Leg, index: number): string {
  const from = plottedById.get(leg.fromVisitId);
  const to = plottedById.get(leg.toVisitId);
  if (!from || !to) return '';
  return buildRouteGeometry(from, to, index).d;
}

function buildMapContent(
  plottedVisits: PlottedVisit[],
  legs: Leg[],
  yearColor: string,
  camera: PosterBuildInput['camera']
): string {
  const plottedById = new Map(plottedVisits.map((visit) => [visit.id, visit]));
  const countryPaths = countryFeatures
    .map((country) => `<path class="country" d="${pathGenerator(country) ?? ''}" />`)
    .join('');

  const routePaths = legs
    .map((leg, index) => {
      const d = routePath(legs, plottedById, leg, index);
      if (!d) return '';
      const dash = transportDash(leg.transport);
      const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
      return `<path class="route-line" d="${d}" stroke="${yearColor}"${dashAttr} />`;
    })
    .join('');

  const nodes = plottedVisits
    .map((visit) => {
      const auraR = 18 + visit.rating * 3.8;
      const coreR = 5 + visit.rating * 1.6;
      return `<g class="visit-node" transform="translate(${visit.x.toFixed(2)} ${visit.y.toFixed(2)})">
        <circle class="node-aura" r="${auraR.toFixed(2)}" fill="${yearColor}" />
        <circle class="node-core" r="${coreR.toFixed(2)}" fill="${yearColor}" />
      </g>`;
    })
    .join('');

  return `<g transform="translate(${camera.pan.x.toFixed(2)} ${camera.pan.y.toFixed(2)}) scale(${camera.scale.toFixed(4)})">
    <path class="sphere" d="${spherePath}" />
    <path class="graticule" d="${graticulePath}" />
    ${countryPaths}
    ${routePaths}
    ${nodes}
  </g>`;
}

function buildStatsRow(stats: PosterStats): string {
  const columns = [
    { value: String(stats.visitCount), label: '旅行节点' },
    { value: String(stats.countryCount), label: '到访地区' },
    { value: formatRating(stats), label: '均分' }
  ];
  const colWidth = POSTER_WIDTH / 3;

  return columns
    .map((column, index) => {
      const x = colWidth * index + colWidth / 2;
      return `<text x="${x}" y="${POSTER_LAYOUT.statsY}" text-anchor="middle" font-family="${FONT}" font-size="56" font-weight="700" fill="#1e343e">${escapeXml(column.value)}</text>
      <text x="${x}" y="${POSTER_LAYOUT.statsY + 34}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#7b8f96">${escapeXml(column.label)}</text>`;
    })
    .join('');
}

export function buildPosterSvg(input: PosterBuildInput): string {
  const { year, yearColor, stats, plottedVisits, legs, camera, mapRegion } = input;
  const cardRadius = 24;
  const mapContent = buildMapContent(plottedVisits, legs, yearColor, camera);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}">
  <defs>
    <linearGradient id="poster-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f3fbfb" />
      <stop offset="48%" stop-color="#faf7f2" />
      <stop offset="100%" stop-color="#eef6ef" />
    </linearGradient>
    <linearGradient id="year-accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${yearColor}" stop-opacity="0.85" />
      <stop offset="100%" stop-color="${yearColor}" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="ocean-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#dff2f2" />
      <stop offset="45%" stop-color="#f8fbf7" />
      <stop offset="100%" stop-color="#e7f0e3" />
    </linearGradient>
    <clipPath id="map-clip">
      <rect x="${mapRegion.x}" y="${mapRegion.y}" width="${mapRegion.width}" height="${mapRegion.height}" rx="${cardRadius}" />
    </clipPath>
    <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="rgba(25, 47, 65, 0.12)" />
    </filter>
    <style>${POSTER_STYLES}</style>
  </defs>

  <rect width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" fill="url(#poster-bg)" />
  <rect width="${POSTER_WIDTH}" height="${POSTER_LAYOUT.accentHeight}" fill="url(#year-accent)" />

  <text x="${POSTER_WIDTH / 2}" y="${POSTER_LAYOUT.brandY}" text-anchor="middle" font-family="${FONT}" font-size="14" letter-spacing="0.18em" fill="#7b8f96">SPACETIME · TRAVEL</text>
  <text x="${POSTER_WIDTH / 2}" y="${POSTER_LAYOUT.titleY}" text-anchor="middle" font-family="${FONT}" font-size="48" font-weight="700" fill="${yearColor}">${year} 旅行足迹</text>

  <g clip-path="url(#map-clip)" filter="url(#card-shadow)">
    <rect x="${mapRegion.x}" y="${mapRegion.y}" width="${mapRegion.width}" height="${mapRegion.height}" rx="${cardRadius}" fill="#ffffff" />
    <rect x="${mapRegion.x}" y="${mapRegion.y}" width="${mapRegion.width}" height="${mapRegion.height}" rx="${cardRadius}" fill="url(#ocean-sheen)" opacity="0.35" />
    ${mapContent}
  </g>

  ${buildStatsRow(stats)}

  <text x="${POSTER_WIDTH / 2}" y="${POSTER_LAYOUT.watermarkY}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#a8b8be">spacetime-travel</text>
</svg>`;
}
