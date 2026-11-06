import type { Segment } from "@/types";
import { calculateVelocity } from "@/utils/physics";

const DEFAULT_RIDER_WEIGHT_KG = 75;
const DEFAULT_BIKE_WEIGHT_KG = 9;
const DEFAULT_FILTER_MIN_RATIO = 0.95;

type NumericInput = number | string | null | undefined;

export type IntervalProfile = {
  powerWatts: number;
  riderWeightKg: number;
  bikeWeightKg: number;
};

// Converts mixed UI input (number/string/empty) into a number for filter math.
function parseNumericInput(value: NumericInput): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  return Number.NaN;
}

// Uses fallback defaults when rider or bike weight is missing/invalid.
function parsePositiveOrDefault(value: NumericInput, fallback: number): number {
  const parsed = parseNumericInput(value);
  return parsed > 0 ? parsed : fallback;
}

export function parseIntervalMinutes(value: NumericInput): number | null {
  const parsed = parseNumericInput(value);
  return parsed > 0 ? parsed : null;
}

export function createIntervalProfile(
  powerInput: NumericInput,
  riderWeightInput: NumericInput,
  bikeWeightInput: NumericInput
): IntervalProfile | null {
  const powerWatts = parseNumericInput(powerInput);
  if (!(powerWatts > 0)) return null;

  return {
    powerWatts,
    riderWeightKg: parsePositiveOrDefault(riderWeightInput, DEFAULT_RIDER_WEIGHT_KG),
    bikeWeightKg: parsePositiveOrDefault(bikeWeightInput, DEFAULT_BIKE_WEIGHT_KG),
  };
}

type SegmentTimingInput = Pick<Segment, "distance_km" | "gradient_pct" | "elevation_profile">;

// Splits the stored [distance_m, altitude_m] profile into (length share, gradient) pieces.
function profilePieces(elevationProfile: Segment["elevation_profile"]): Array<[number, number]> | null {
  if (!elevationProfile || elevationProfile.length < 2) return null;
  const total = elevationProfile[elevationProfile.length - 1][0] - elevationProfile[0][0];
  if (!(total > 0)) return null;
  const pieces: Array<[number, number]> = [];
  for (let i = 1; i < elevationProfile.length; i++) {
    const [d0, a0] = elevationProfile[i - 1];
    const [d1, a1] = elevationProfile[i];
    const length = d1 - d0;
    if (length > 0) pieces.push([length / total, (a1 - a0) / length]);
  }
  return pieces.length > 0 ? pieces : null;
}

// Estimates completion time for one segment at the rider profile's power and mass.
// Sums time over the elevation profile when available, since a segment's average gradient
// hides steep and flat sections that change the time at constant power.
export function estimateSegmentDurationSeconds(
  segment: SegmentTimingInput,
  profile: IntervalProfile
): number | null {
  if (!(segment.distance_km > 0)) return null;
  const distanceM = segment.distance_km * 1000;
  const pieces = profilePieces(segment.elevation_profile) ?? [[1, (segment.gradient_pct ?? 0) / 100]];
  let seconds = 0;
  for (const [share, gradient] of pieces) {
    const velocity = calculateVelocity(profile.powerWatts, gradient, profile.riderWeightKg, profile.bikeWeightKg);
    if (!(velocity > 0)) return null;
    seconds += (share * distanceM) / velocity;
  }
  return seconds;
}

type SegmentFilterInput = Pick<Segment, "distance_km" | "gradient_pct" | "blocked">;

export function passesIntervalFilter(
  segment: SegmentFilterInput,
  profile: IntervalProfile,
  targetMinutes: number,
  minRatio: number = DEFAULT_FILTER_MIN_RATIO
): boolean {
  if (segment.blocked) return false;
  if (!(targetMinutes > 0)) return false;
  const durationSec = estimateSegmentDurationSeconds(segment, profile);
  if (!durationSec) return false;
  return durationSec >= targetMinutes * 60 * minRatio;
}

type FilterSegmentsOptions = {
  isFiltered: boolean;
  filterPower: NumericInput;
  filterTimeMinutes: NumericInput;
  riderWeight: NumericInput;
  bikeWeight: NumericInput;
  minRatio?: number;
};

export function filterSegmentsByInterval(
  segments: Segment[],
  {
    isFiltered,
    filterPower,
    filterTimeMinutes,
    riderWeight,
    bikeWeight,
    minRatio = DEFAULT_FILTER_MIN_RATIO,
  }: FilterSegmentsOptions
): Segment[] {
  // Fast path: skip any math when the filter toggle is off.
  if (!isFiltered) return segments;

  const profile = createIntervalProfile(filterPower, riderWeight, bikeWeight);
  const targetMinutes = parseIntervalMinutes(filterTimeMinutes);
  // If filter inputs are not usable, keep the unfiltered list to avoid hiding data unexpectedly.
  if (!profile || !targetMinutes) return segments;

  return segments.filter((segment) => passesIntervalFilter(segment, profile, targetMinutes, minRatio));
}

// Returns how far above/below the target interval time a segment is (1.0 = exactly at target).
export function getIntervalMarginRatio(
  segment: SegmentTimingInput,
  profile: IntervalProfile,
  targetMinutes: number
): number | null {
  if (!(targetMinutes > 0)) return null;
  const durationSec = estimateSegmentDurationSeconds(segment, profile);
  if (!durationSec) return null;
  return durationSec / (targetMinutes * 60);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
