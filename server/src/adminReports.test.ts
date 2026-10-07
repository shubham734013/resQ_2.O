import test from 'node:test';
import assert from 'node:assert/strict';
import { reportsExportQuerySchema, reportsQuerySchema } from './schemas/admin.js';
import { REPORT_STATUSES, __private as reportPrivate } from './services/adminReportService.js';

test('report date range accepts valid ISO dates', () => {
  const result = reportsQuerySchema.safeParse({ from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T23:59:59.999Z' });
  assert.equal(result.success, true);
});

test('report date range rejects reversed dates', () => {
  const result = reportsQuerySchema.safeParse({ from: '2026-02-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' });
  assert.equal(result.success, false);
});

test('report date range rejects ranges over 366 days', () => {
  const result = reportsExportQuerySchema.safeParse({ from: '2025-01-01T00:00:00.000Z', to: '2026-02-15T00:00:00.000Z' });
  assert.equal(result.success, false);
});

test('report status contract remains the emergency workflow statuses', () => {
  assert.deepEqual(REPORT_STATUSES, ['RECEIVED','REVIEWING','PREPARING','AMBULANCE_COORDINATION','RESOLVED','CANCELLED']);
});

test('emergency report matcher uses UTC-safe date predicates', () => {
  const match = reportPrivate.emergencyMatch({ from: new Date('2026-01-01T00:00:00.000Z'), to: new Date('2026-01-31T23:59:59.999Z') });
  assert.deepEqual(match, { reportedAt: { $gte: new Date('2026-01-01T00:00:00.000Z'), $lte: new Date('2026-01-31T23:59:59.999Z') } });
});

test('emergency report matcher is empty when no date range is selected', () => {
  assert.deepEqual(reportPrivate.emergencyMatch({}), {});
});
