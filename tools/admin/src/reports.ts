/**
 * `reports list` (DESIGN.md §3.7, §8.2; PRIVACY.md R20), read-only. Nobody reviews reports (F17) and their text is
 * never read, so the CLI reads only a projection: category, target type, status, the automated decision code and the
 * dates. Report text, the copied chat message, reporter and target uids and the pod id never leave Firestore.
 */
import { REPORT_CATEGORIES, type ReportCategory } from '@grouper/core';
import type { Firestore, Query } from 'firebase-admin/firestore';
import { UsageError } from './args';
import { isoOf, millisOf, table } from './format';

export const REPORTS = 'reports';
/** The only fields `reports list` reads. */
export const REPORT_LIST_FIELDS = ['category', 'target.type', 'status', 'decision', 'createdAt', 'expiresAt'] as const;

export interface ReportRow {
  readonly id: string;
  readonly createdAt: string;
  readonly category: string;
  readonly targetType: string;
  readonly status: string;
  readonly decision: string;
  readonly expiresAt: string;
}

export interface ReportFilter {
  readonly status?: 'open' | 'resolved';
  readonly category?: ReportCategory;
  readonly limit: number;
}

export function parseReportFilter(status: string | undefined, category: string | undefined, limit: number | undefined): ReportFilter {
  if (status !== undefined && status !== 'open' && status !== 'resolved') throw new UsageError('--status must be open or resolved');
  if (category !== undefined && !(REPORT_CATEGORIES as readonly string[]).includes(category)) {
    throw new UsageError(`--category must be one of ${REPORT_CATEGORIES.join(', ')}`);
  }
  return {
    ...(status === undefined ? {} : { status }),
    ...(category === undefined ? {} : { category: category as ReportCategory }),
    limit: limit ?? 50,
  };
}

/** Newest first. Sorted in memory, so the equality filters need no composite index. */
export async function listReports(db: Firestore, filter: ReportFilter): Promise<ReportRow[]> {
  let q: Query = db.collection(REPORTS);
  if (filter.status) q = q.where('status', '==', filter.status);
  if (filter.category) q = q.where('category', '==', filter.category);
  const snap = await q.select(...REPORT_LIST_FIELDS).get();
  return snap.docs
    .map((d) => ({ d, created: millisOf(d.get('createdAt')) ?? 0 }))
    .sort((a, b) => b.created - a.created || (a.d.id < b.d.id ? -1 : 1))
    .slice(0, filter.limit)
    .map(({ d }) => ({
      id: d.id,
      createdAt: isoOf(d.get('createdAt')),
      category: String(d.get('category') ?? '-'),
      targetType: String(d.get('target.type') ?? '-'),
      status: String(d.get('status') ?? '-'),
      decision: String(d.get('decision') ?? '-'),
      expiresAt: isoOf(d.get('expiresAt')),
    }));
}

export function formatReports(rows: readonly ReportRow[]): string {
  if (rows.length === 0) return 'no reports';
  return table(
    ['id', 'created', 'category', 'target', 'status', 'decision', 'expires'],
    rows.map((r) => [r.id, r.createdAt, r.category, r.targetType, r.status, r.decision, r.expiresAt]),
    7,
  );
}
