export type AppRouteName = 'map' | 'stats';

export type AppRoute =
  | { name: 'map' }
  | { name: 'stats'; year: number | 'all' };

export type NavigateOptions = {
  replace?: boolean;
};

const STATS_PATH = '/stats';

/** Normalize pathname: strip trailing slashes except root. */
export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

export function parseStatsYear(search: string): number | 'all' {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = params.get('year');
  if (raw == null || raw === '' || raw === 'all') return 'all';
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return 'all';
  return year;
}

export function parseRoute(pathname: string, search = ''): AppRoute {
  const path = normalizePathname(pathname);
  if (path === STATS_PATH) {
    return { name: 'stats', year: parseStatsYear(search) };
  }
  return { name: 'map' };
}

export function routeFromLocation(
  location: Pick<Location, 'pathname' | 'search'> = window.location
): AppRoute {
  return parseRoute(location.pathname, location.search);
}

export function mapPath(): string {
  return '/';
}

export function statsPath(year: number | 'all' = 'all'): string {
  if (year === 'all') return STATS_PATH;
  return `${STATS_PATH}?year=${year}`;
}

export function pathForRoute(route: AppRoute): string {
  return route.name === 'stats' ? statsPath(route.year) : mapPath();
}

export function navigate(to: string, options: NavigateOptions = {}): void {
  const url = new URL(to, window.location.origin);
  const current = `${window.location.pathname}${window.location.search}`;
  const next = `${url.pathname}${url.search}`;
  if (current === next) return;

  if (options.replace) {
    window.history.replaceState(window.history.state, '', next);
  } else {
    window.history.pushState(window.history.state, '', next);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateToRoute(route: AppRoute, options: NavigateOptions = {}): void {
  navigate(pathForRoute(route), options);
}
