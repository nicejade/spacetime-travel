import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCHEMA_VERSION } from './migrations.js';
import {
  EXPORT_FORMAT,
  buildExportDocument,
  parseExportDocument
} from './exportImport.js';

describe('parseExportDocument', () => {
  it('accepts a valid export document', () => {
    const parsed = parseExportDocument({
      format: EXPORT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: '2026-07-11T00:00:00.000Z',
      visits: []
    });
    assert.equal(parsed.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(parsed.visits, []);
  });

  it('rejects non-objects and wrong format', () => {
    assert.throws(() => parseExportDocument(null), /JSON 对象/);
    assert.throws(() => parseExportDocument([]), /JSON 对象/);
    assert.throws(
      () =>
        parseExportDocument({
          format: 'other',
          schemaVersion: 1,
          visits: []
        }),
      /无法识别/
    );
  });

  it('rejects missing or future schemaVersion', () => {
    assert.throws(
      () =>
        parseExportDocument({
          format: EXPORT_FORMAT,
          visits: []
        }),
      /schemaVersion/
    );
    assert.throws(
      () =>
        parseExportDocument({
          format: EXPORT_FORMAT,
          schemaVersion: SCHEMA_VERSION + 1,
          visits: []
        }),
      /高于当前应用/
    );
  });

  it('rejects non-array visits', () => {
    assert.throws(
      () =>
        parseExportDocument({
          format: EXPORT_FORMAT,
          schemaVersion: 1,
          visits: {}
        }),
      /visits 必须是数组/
    );
  });
});

describe('buildExportDocument', () => {
  it('stamps the current schema version and format', () => {
    const doc = buildExportDocument([], '2026-01-01T00:00:00.000Z');
    assert.equal(doc.format, EXPORT_FORMAT);
    assert.equal(doc.schemaVersion, SCHEMA_VERSION);
    assert.equal(doc.exportedAt, '2026-01-01T00:00:00.000Z');
    assert.deepEqual(doc.visits, []);
  });
});
