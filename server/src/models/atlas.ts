import { buildYearColors, visitYear } from '../../../shared/years.js';
import { db } from '../db/connection.js';
import { buildVisitRoutes } from '../visitRoutes.js';
import {
  listLegRows,
  listOriginSuggestions,
  listVisitRows,
  normalizeLeg,
  normalizeVisit
} from './visit.js';

export function getAtlas() {
  const visits = listVisitRows(db).map(normalizeVisit);
  const legs = listLegRows(db).map(normalizeLeg);
  const visitRoutes = buildVisitRoutes(visits);
  const originSuggestions = listOriginSuggestions(db);
  const yearNums = visits.map((visit) => visitYear(visit.arrivedAt)).filter(Number.isFinite);
  const yearSet = [...new Set(yearNums)].sort((a, b) => b - a);
  const countries = new Set(visits.map((visit) => visit.location.country));
  const ratings = visits.map((visit) => Number(visit.rating)).filter(Number.isFinite);

  return {
    visits,
    legs,
    visitRoutes,
    originSuggestions,
    years: yearSet,
    yearColors: buildYearColors(yearSet),
    stats: {
      visitCount: visits.length,
      countryCount: countries.size,
      averageRating:
        ratings.length > 0
          ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1))
          : 0,
      startYear: yearNums.length ? Math.min(...yearNums) : null,
      endYear: yearNums.length ? Math.max(...yearNums) : null
    }
  };
}
