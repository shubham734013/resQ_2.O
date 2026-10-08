import { z } from 'zod';

export const locationUpdateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(10000),
  timestamp: z.number().int().positive(),
}).strict().refine((value) => value.timestamp <= Date.now() + 5 * 60 * 1000, {
  path: ['timestamp'],
  message: 'timestamp cannot be more than 5 minutes in the future',
});
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;

export const getLocationFreshness = (
  updatedAt?: Date | string | number,
  now = Date.now(),
): 'LIVE' | 'RECENT' | 'STALE' | 'OFFLINE' | 'UNKNOWN' => {
  if (!updatedAt) return 'UNKNOWN';
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return 'UNKNOWN';
  const ageMs = Math.max(0, now - timestamp);
  if (ageMs < 30_000) return 'LIVE';
  if (ageMs <= 120_000) return 'RECENT';
  return 'STALE';
};
