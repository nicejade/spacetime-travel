import type { Visit } from '$lib/types';
import type { PosterStats } from './types';

export function computeYearStats(visits: Visit[]): PosterStats {
  const countries = new Set(visits.map((visit) => visit.location.country).filter(Boolean));
  const ratings = visits.map((visit) => visit.rating).filter((rating) => rating > 0);

  return {
    visitCount: visits.length,
    countryCount: countries.size,
    averageRating: ratings.length
      ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
      : null
  };
}
