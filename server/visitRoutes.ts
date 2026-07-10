import type { Location, VisitRoute } from '../client/lib/types.js';

export interface VisitRouteSource {
  id: number;
  returnsToOrigin: boolean;
  outboundTransport: string;
  outboundNote: string;
  returnTransport: string | null;
  returnNote: string;
  origin: Location;
  location: Location;
}

export function buildVisitRoutes(visits: VisitRouteSource[]): VisitRoute[] {
  const routes: VisitRoute[] = [];

  for (const visit of visits) {
    routes.push({
      visitId: visit.id,
      kind: 'outbound',
      from: visit.origin,
      to: visit.location,
      transport: visit.outboundTransport,
      note: visit.outboundNote
    });

    if (visit.returnsToOrigin) {
      routes.push({
        visitId: visit.id,
        kind: 'return',
        from: visit.location,
        to: visit.origin,
        transport: visit.returnTransport ?? visit.outboundTransport,
        note: visit.returnNote
      });
    }
  }

  return routes;
}
