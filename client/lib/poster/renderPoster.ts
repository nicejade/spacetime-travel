import { plotVisits } from '$lib/movie/plotVisits';
import { buildPosterSvg } from './buildPosterSvg';
import { computePosterBounds } from './bounds';
import { computeYearStats } from './stats';
import {
  POSTER_HEIGHT,
  POSTER_LAYOUT,
  POSTER_WIDTH,
  type PosterGenerateInput
} from './types';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('SVG render failed'));
    image.src = url;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed'));
    }, 'image/png');
  });
}

export async function renderPosterPng(svgString: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    ctx.drawImage(image, 0, 0, POSTER_WIDTH, POSTER_HEIGHT);
    return await canvasToPngBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function buildPosterFilename(year: number): string {
  return `spacetime-travel-${year}.png`;
}

export async function generatePoster(input: PosterGenerateInput): Promise<Blob> {
  const plottedVisits = plotVisits(input.visits, input.yearColors);
  const stats = computeYearStats(input.visits);
  const mapRegion = {
    x: POSTER_LAYOUT.marginX,
    y: POSTER_LAYOUT.mapCardY,
    width: POSTER_WIDTH - POSTER_LAYOUT.marginX * 2,
    height: POSTER_LAYOUT.mapCardHeight
  };
  const camera = computePosterBounds(plottedVisits, mapRegion);
  const svg = buildPosterSvg({
    year: input.year,
    yearColor: input.yearColor,
    stats,
    plottedVisits,
    legs: input.legs,
    camera,
    mapRegion
  });

  return renderPosterPng(svg);
}
