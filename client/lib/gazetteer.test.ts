import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchPlaces, type Place } from './gazetteer';

function place(partial: Partial<Place> & Pick<Place, 'nameZh' | 'nameEn'>): Place {
  return {
    name: partial.nameZh || partial.nameEn,
    country: partial.country ?? '某处',
    countryCode: partial.countryCode ?? 'XX',
    lat: 0,
    lng: 0,
    population: partial.population ?? 1,
    ...partial
  };
}

describe('matchPlaces', () => {
  it('returns empty for blank queries', () => {
    assert.deepEqual(matchPlaces([place({ nameZh: '北京', nameEn: 'Beijing' })], '   '), []);
  });

  it('matches Chinese diacritic-insensitive via shared normalize', () => {
    const places = [place({ nameZh: 'São', nameEn: 'OtherName', population: 10 })];
    const found = matchPlaces(places, 'sao');
    assert.equal(found.length, 1);
    assert.equal(found[0].nameZh, 'São');
  });

  it('matches English case-insensitively', () => {
    const places = [place({ nameZh: '', nameEn: 'Tokyo', population: 10 })];
    const found = matchPlaces(places, 'TOKYO');
    assert.equal(found.length, 1);
    assert.equal(found[0].nameEn, 'Tokyo');
  });

  it('ranks prefix matches above substring matches', () => {
    const places = [
      place({ nameZh: '北海', nameEn: 'Beihai', population: 100 }),
      place({ nameZh: '海口', nameEn: 'Haikou', population: 1 })
    ];
    const found = matchPlaces(places, '海');
    assert.equal(found[0].nameZh, '海口');
    assert.equal(found[1].nameZh, '北海');
  });

  it('ranks higher population when scores tie', () => {
    const places = [
      place({ nameZh: '巴黎', nameEn: 'Paris', population: 10 }),
      place({ nameZh: '帕里斯', nameEn: 'Parisville', population: 100 })
    ];
    // Both prefix on English "paris..." — Parisville starts with paris, Paris exact prefix
    // Actually Paris is prefix score 3, Parisville is prefix score 3 for "paris"
    const found = matchPlaces(places, 'paris');
    assert.equal(found[0].nameEn, 'Parisville');
  });

  it('matches country fields at a lower score than name hits', () => {
    const places = [
      place({ nameZh: '大阪', nameEn: 'Osaka', country: '日本', countryCode: 'JP', population: 1 }),
      place({ nameZh: '京都', nameEn: 'Kyoto', country: '日本', countryCode: 'JP', population: 100 })
    ];
    const byCountry = matchPlaces(places, '日本');
    assert.equal(byCountry.length, 2);
    assert.equal(byCountry[0].nameZh, '京都');

    const byName = matchPlaces(
      [
        place({ nameZh: '日本桥', nameEn: 'Nihonbashi', country: '日本', countryCode: 'JP', population: 1 }),
        place({ nameZh: '大阪', nameEn: 'Osaka', country: '日本', countryCode: 'JP', population: 100 })
      ],
      '日本'
    );
    assert.equal(byName[0].nameZh, '日本桥');
  });
});
