#!/usr/bin/env node
/**
 * Build the offline gazetteer used by the location picker.
 *
 * Data source: GeoNames public dumps.
 *   - cities15000.txt      major populated places
 *   - countryInfo.txt      ISO codes + per-country geoname id
 *   - alternateNamesV2.txt  localized names (filtered to isolanguage = zh)
 *
 * Selection rule: population >= 100,000 OR capital (feature code PPLC), so no
 * small-country capital is dropped. Records are compressed with short keys and
 * de-duplicated by "name + country", keeping the most populous.
 *
 * Outputs (committed to the repo, no network needed at dev/runtime):
 *   - client/lib/data/gazetteer.json
 *   - client/lib/data/countries-zh.json
 *
 * Run manually with: pnpm build:gazetteer
 */

import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const cacheDir = join(__dirname, '.cache');
const dataDir = join(rootDir, 'client', 'lib', 'data');

const BASE_URL = 'https://download.geonames.org/export/dump';
const MIN_POPULATION = 100_000;

const files = {
  cities: { name: 'cities15000', zip: true },
  alternates: { name: 'alternateNamesV2', zip: true },
  countryInfo: { name: 'countryInfo.txt', zip: false }
};

async function download(fileName) {
  const target = join(cacheDir, fileName);
  try {
    await readFile(target);
    console.log(`· cached  ${fileName}`);
    return target;
  } catch {
    // not cached yet
  }
  console.log(`· fetch   ${fileName}`);
  await run('curl', ['-fsSL', '--retry', '3', '-o', target, `${BASE_URL}/${fileName}`], {
    maxBuffer: 1024 * 1024 * 1024
  });
  return target;
}

async function unzip(zipPath) {
  console.log(`· unzip   ${zipPath.split('/').pop()}`);
  await run('unzip', ['-o', zipPath, '-d', cacheDir], { maxBuffer: 1024 * 1024 * 32 });
}

function normalizeNumericId(value) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? '' : String(parsed);
}

/** countryInfo.txt → maps for ISO2 and per-country geoname id. */
async function parseCountryInfo(path) {
  const text = await readFile(path, 'utf8');
  const iso2ToCountry = new Map(); // ISO2 -> { numericId, geonameId, englishName }
  const geonameIdToIso2 = new Map(); // country geonameId -> ISO2

  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const cols = line.split('\t');
    const iso2 = cols[0];
    const numericId = normalizeNumericId(cols[2]);
    const englishName = cols[4];
    const geonameId = cols[16];
    if (!iso2 || !geonameId) continue;
    iso2ToCountry.set(iso2, { numericId, geonameId, englishName });
    geonameIdToIso2.set(geonameId, iso2);
  }

  return { iso2ToCountry, geonameIdToIso2 };
}

/** cities15000.txt → selected city records keyed by geoname id. */
async function parseCities(path) {
  const cities = new Map(); // geonameId -> city
  const stream = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });

  for await (const line of stream) {
    if (!line) continue;
    const cols = line.split('\t');
    const geonameId = cols[0];
    const asciiName = cols[2];
    const lat = Number(cols[4]);
    const lng = Number(cols[5]);
    const featureCode = cols[7];
    const iso2 = cols[8];
    const population = Number(cols[14]) || 0;

    const isCapital = featureCode === 'PPLC';
    if (!isCapital && population < MIN_POPULATION) continue;
    if (!iso2 || Number.isNaN(lat) || Number.isNaN(lng)) continue;

    cities.set(geonameId, {
      geonameId,
      n: asciiName,
      c: iso2,
      // 3 decimals ≈ 110m, ample precision for a city marker while trimming bytes.
      lat: Number(lat.toFixed(3)),
      lng: Number(lng.toFixed(3)),
      // Population stored in thousands; only used for relative sort ordering.
      p: Math.round(population / 1000)
    });
  }

  return cities;
}

/**
 * Stream alternateNamesV2.txt (huge) once, keeping only Chinese names for the
 * geoname ids we care about (selected cities + all countries).
 * Preference order: isPreferredName, then shortest non-historic entry.
 */
async function parseChineseNames(path, wantedIds) {
  const best = new Map(); // geonameId -> { name, preferred }
  const stream = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });

  for await (const line of stream) {
    if (!line) continue;
    const cols = line.split('\t');
    const geonameId = cols[1];
    const isoLanguage = cols[2];
    if (isoLanguage !== 'zh') continue;
    if (!wantedIds.has(geonameId)) continue;

    const name = cols[3];
    const preferred = cols[4] === '1';
    const historic = cols[7] === '1';
    if (!name || historic) continue;
    // Skip pinyin / romanized variants; keep Han-character names only.
    if (!/[\u4e00-\u9fff]/.test(name)) continue;

    const current = best.get(geonameId);
    if (!current) {
      best.set(geonameId, { name, preferred });
      continue;
    }
    if (preferred && !current.preferred) {
      best.set(geonameId, { name, preferred });
    } else if (preferred === current.preferred && name.length < current.name.length) {
      best.set(geonameId, { name, preferred });
    }
  }

  return best;
}

async function main() {
  await mkdir(cacheDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  const citiesZip = await download(`${files.cities.name}.zip`);
  const alternatesZip = await download(`${files.alternates.name}.zip`);
  const countryInfoPath = await download(files.countryInfo.name);

  await unzip(citiesZip);
  await unzip(alternatesZip);

  const citiesTxt = join(cacheDir, `${files.cities.name}.txt`);
  const alternatesTxt = join(cacheDir, `${files.alternates.name}.txt`);

  console.log('· parse   countryInfo');
  const { iso2ToCountry, geonameIdToIso2 } = await parseCountryInfo(countryInfoPath);

  console.log('· parse   cities15000');
  const cities = await parseCities(citiesTxt);

  const wantedIds = new Set([...cities.keys(), ...geonameIdToIso2.keys()]);

  console.log('· parse   alternateNamesV2 (zh) — this streams ~1.5GB, please wait');
  const zhNames = await parseChineseNames(alternatesTxt, wantedIds);

  // ISO numeric -> Chinese country name.
  const countriesZh = {};
  for (const [iso2, info] of iso2ToCountry) {
    const zh = zhNames.get(info.geonameId)?.name;
    if (zh && info.numericId) countriesZh[info.numericId] = zh;
  }

  // ISO2 -> Chinese country name, for stamping onto each city record.
  const iso2ToZhCountry = new Map();
  for (const [iso2, info] of iso2ToCountry) {
    const zh = zhNames.get(info.geonameId)?.name;
    if (zh) iso2ToZhCountry.set(iso2, zh);
  }

  // Build records, de-duplicating by "displayName + country".
  const byKey = new Map();
  for (const city of cities.values()) {
    const zh = zhNames.get(city.geonameId)?.name || '';
    const cz = iso2ToZhCountry.get(city.c) || '';
    const record = {
      z: zh,
      n: city.n,
      cz,
      c: city.c,
      lat: city.lat,
      lng: city.lng,
      p: city.p
    };
    const key = `${zh || city.n}|${city.c}`;
    const existing = byKey.get(key);
    if (!existing || record.p > existing.p) byKey.set(key, record);
  }

  const records = [...byKey.values()].sort((a, b) => b.p - a.p);

  const gazetteerPath = join(dataDir, 'gazetteer.json');
  const countriesPath = join(dataDir, 'countries-zh.json');
  await writeFile(gazetteerPath, JSON.stringify(records));
  await writeFile(countriesPath, `${JSON.stringify(countriesZh, null, 2)}\n`);

  const sizeKb = (JSON.stringify(records).length / 1024).toFixed(0);
  const withZh = records.filter((r) => r.z).length;
  console.log('');
  console.log(`✓ gazetteer.json    ${records.length} places (${withZh} with 中文名), ~${sizeKb}KB`);
  console.log(`✓ countries-zh.json ${Object.keys(countriesZh).length} countries`);
  console.log('');
  console.log('Cache kept at scripts/.cache (gitignored). Delete it to force a fresh download.');
}

main().catch(async (error) => {
  console.error('\nbuild-gazetteer failed:', error.message);
  console.error('If GeoNames is unreachable, curate a smaller bilingual list (plan B) with the same shape.');
  process.exitCode = 1;
  await rm(join(cacheDir, 'partial'), { force: true }).catch(() => {});
});
