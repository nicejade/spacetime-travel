/**
 * Compatibility re-export. Prefer `models/location` in new code.
 */
export {
  ensureLocation,
  ensureLocationUniqueIndex,
  findLocationByNameCountry,
  mergeDuplicateLocations,
  purgeOrphanLocations,
  type LocationInput
} from './models/location.js';
