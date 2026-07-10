import type { Leg } from '$lib/types';
import { computeCameraTarget, computeDwellCamera, smoothCamera } from './cameraRig';
import { easeInOutCubic } from './easing';
import { buildRouteGeometry, sampleRouteAtProgress, type RouteGeometry } from './pathSampler';
import {
  buildMovieSegments,
  dwellCaptionOpacity,
  locateSegment,
  totalDurationMs
} from './timeline';
import type {
  CameraState,
  MovieEngineOptions,
  MovieFrameState,
  MovieSegment,
  PlottedVisit,
  Point2D,
  ResolvedLeg
} from './types';

function resolveLegs(visits: PlottedVisit[], legs: Leg[]): ResolvedLeg[] {
  const resolved: ResolvedLeg[] = [];

  for (let index = 0; index < visits.length - 1; index += 1) {
    const from = visits[index];
    const to = visits[index + 1];
    const leg =
      legs.find((item) => item.fromVisitId === from.id && item.toVisitId === to.id) ?? null;
    const transport = leg?.transport || to.inboundTransport || 'walk';

    resolved.push({
      leg,
      transport,
      fromIndex: index,
      toIndex: index + 1
    });
  }

  return resolved;
}

export class MovieEngine {
  readonly visits: PlottedVisit[];
  readonly segments: MovieSegment[];
  readonly routes: RouteGeometry[];
  readonly resolvedLegs: ResolvedLeg[];
  readonly totalDuration: number;

  private viewportWidth: number;
  private viewportHeight: number;
  private elapsedMs = 0;
  private camera: CameraState;

  constructor(options: MovieEngineOptions) {
    this.visits = [...options.visits].sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
    this.viewportWidth = options.viewportWidth;
    this.viewportHeight = options.viewportHeight;
    this.segments = buildMovieSegments(this.visits.length);
    this.totalDuration = totalDurationMs(this.segments);
    this.resolvedLegs = resolveLegs(this.visits, options.legs);
    this.routes = this.resolvedLegs.map((item, index) =>
      buildRouteGeometry(this.visits[item.fromIndex], this.visits[item.toIndex], index)
    );

    const firstVisit = this.visits[0];
    this.camera = firstVisit
      ? computeDwellCamera(
          { x: firstVisit.x, y: firstVisit.y },
          this.resolvedLegs[0]?.transport || firstVisit.outboundTransport || 'walk',
          this.viewportWidth,
          this.viewportHeight
        )
      : { pan: { x: 0, y: 0 }, scale: 0.52 };
  }

  setViewport(width: number, height: number) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  setElapsedMs(elapsedMs: number): MovieFrameState {
    this.elapsedMs = Math.max(0, Math.min(elapsedMs, this.totalDuration));
    return this.computeFrame();
  }

  getElapsedMs(): number {
    return this.elapsedMs;
  }

  isComplete(): boolean {
    return this.elapsedMs >= this.totalDuration;
  }

  private computeFrame(): MovieFrameState {
    if (this.visits.length === 0) {
      return {
        phase: 'dwell',
        pathProgress: 0,
        lightPosition: { x: 0, y: 0 },
        camera: this.camera,
        activeVisitIndex: 0,
        activeLegIndex: null,
        segmentProgress: 0,
        globalProgress: 1,
        dwellCaptionOpacity: 0,
        complete: true
      };
    }

    const { segment, segmentElapsedMs } = locateSegment(this.segments, this.elapsedMs);
    const segmentProgress = segment.durationMs === 0 ? 1 : segmentElapsedMs / segment.durationMs;
    const globalProgress = this.totalDuration === 0 ? 1 : this.elapsedMs / this.totalDuration;
    const complete = this.elapsedMs >= this.totalDuration;

    if (segment.phase === 'dwell') {
      const visit = this.visits[segment.visitIndex];
      const transport =
        this.resolvedLegs[segment.visitIndex]?.transport ||
        this.resolvedLegs[segment.visitIndex - 1]?.transport ||
        visit.inboundTransport ||
        visit.outboundTransport ||
        'walk';
      const lightPosition = { x: visit.x, y: visit.y };
      const target = computeDwellCamera(
        lightPosition,
        transport,
        this.viewportWidth,
        this.viewportHeight
      );
      this.camera = smoothCamera(this.camera, target);

      return {
        phase: 'dwell',
        pathProgress: 0,
        lightPosition,
        camera: this.camera,
        activeVisitIndex: segment.visitIndex,
        activeLegIndex: null,
        segmentProgress,
        globalProgress,
        dwellCaptionOpacity: dwellCaptionOpacity(segmentElapsedMs, segment.durationMs),
        complete
      };
    }

    const legIndex = segment.legIndex ?? 0;
    const route = this.routes[legIndex];
    const resolved = this.resolvedLegs[legIndex];
    const eased = easeInOutCubic(segmentProgress);
    const { point, tangent } = sampleRouteAtProgress(route.segments, eased);
    const target = computeCameraTarget(
      point,
      tangent,
      resolved.transport,
      eased,
      this.viewportWidth,
      this.viewportHeight
    );
    this.camera = smoothCamera(this.camera, target);

    return {
      phase: 'travel',
      pathProgress: eased,
      lightPosition: point,
      camera: this.camera,
      activeVisitIndex: resolved.toIndex,
      activeLegIndex: legIndex,
      segmentProgress,
      globalProgress,
      dwellCaptionOpacity: 0,
      complete
    };
  }
}

export function buildExportFilename(visits: PlottedVisit[], selectedYear: number | 'all'): string {
  if (visits.length === 0) return 'spacetime-travel.webm';

  const years = visits
    .map((visit) => Number(visit.arrivedAt.slice(0, 4)))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);

  if (years.length === 0) return 'spacetime-travel.webm';
  if (typeof selectedYear === 'number') return `spacetime-travel-${selectedYear}.webm`;

  const first = years[0];
  const last = years[years.length - 1];
  return first === last ? `spacetime-travel-${first}.webm` : `spacetime-travel-${first}-${last}.webm`;
}

export function computeExportSize(viewportWidth: number, viewportHeight: number): { width: number; height: number } {
  const maxEdge = 1920;
  const scale = Math.min(1, maxEdge / Math.max(viewportWidth, viewportHeight));
  return {
    width: Math.round(viewportWidth * scale),
    height: Math.round(viewportHeight * scale)
  };
}

export function canExportVideo(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

export async function renderSvgToCanvas(
  svg: SVGSVGElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  caption?: { title: string; body: string; opacity: number } | null
): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = EXPORT_STYLE;
  clone.insertBefore(style, clone.firstChild);

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('SVG render failed'));
      element.src = url;
    });
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    if (caption && caption.opacity > 0.01) {
      drawCaption(ctx, width, height, caption);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  caption: { title: string; body: string; opacity: number }
) {
  const boxWidth = Math.min(480, width - 40);
  const boxX = (width - boxWidth) / 2;
  const boxY = height - 190;
  const padding = 20;

  ctx.save();
  ctx.globalAlpha = caption.opacity;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.strokeStyle = 'rgba(62, 86, 91, 0.16)';
  ctx.lineWidth = 1;
  roundRect(ctx, boxX, boxY, boxWidth, 110, 8, true, true);

  ctx.fillStyle = '#1e343e';
  ctx.font = '600 15px Inter, ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(caption.title, boxX + padding, boxY + 28, boxWidth - padding * 2);

  ctx.fillStyle = caption.body === '未记录感受' ? '#7b8f96' : '#2d4650';
  ctx.font =
    caption.body === '未记录感受'
      ? '15px Inter, ui-sans-serif, system-ui, sans-serif'
      : 'italic 20px Inter, ui-sans-serif, system-ui, sans-serif';
  wrapText(ctx, caption.body, boxX + padding, boxY + 58, boxWidth - padding * 2, 26);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: boolean,
  stroke: boolean
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split('');
  let line = '';
  let cursorY = y;

  for (const char of words) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = char;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}

export async function recordMovieVideo(options: {
  svg: SVGSVGElement;
  totalDuration: number;
  width: number;
  height: number;
  onFrame: (elapsedMs: number) => Promise<{
    caption?: { title: string; body: string; opacity: number } | null;
  } | void>;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const { svg, totalDuration, width, height, onFrame, onProgress, signal } = options;
  const fps = 30;
  const frameCount = Math.max(1, Math.ceil((totalDuration / 1000) * fps));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const mimeType = pickMimeType();
  const stream = canvas.captureStream(0);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];

  const recording = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error('Recording failed'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };

  for (let frame = 0; frame < frameCount; frame += 1) {
    if (signal?.aborted) {
      recorder.stop();
      throw new DOMException('Export aborted', 'AbortError');
    }

    const elapsed = (frame / fps) * 1000;
    const frameState = await onFrame(elapsed);
    await renderSvgToCanvas(svg, ctx, width, height, frameState?.caption ?? null);
    track.requestFrame?.();
    onProgress?.((frame + 1) / frameCount);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  }

  recorder.stop();
  return recording;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function pickMimeType(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || 'video/webm';
}

const EXPORT_STYLE = `
  .sphere { fill: #e7f0e3; stroke: rgba(35, 95, 115, 0.16); stroke-width: 1.4; }
  .graticule { fill: none; stroke: rgba(35, 95, 115, 0.13); stroke-width: 1; }
  .country { fill: rgba(255, 255, 255, 0.54); stroke: rgba(71, 103, 101, 0.2); stroke-width: 0.72; }
  .route-line { fill: none; stroke-linecap: round; stroke-width: 4; opacity: 0.78; }
  .route-line.dimmed { opacity: 0.25; }
  .route-line.active { opacity: 1; stroke-width: 5; }
  .visit-node .node-aura { opacity: 0.18; }
  .visit-node .node-core { stroke: #fff; stroke-width: 2; }
  .movie-light-core { fill: #fff; }
  .movie-light-aura { opacity: 0.42; }
`;
