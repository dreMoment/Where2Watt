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

function parseNumericInput(value: NumericInput): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  return Number.NaN;
}

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

type SegmentTimingInput = Pick<Segment, "distance_km" | "gradient_pct">;

export function estimateSegmentDurationSeconds(
  segment: SegmentTimingInput,
  profile: IntervalProfile
): number | null {
  if (!(segment.distance_km > 0)) return null;
  const gradientDecimal = (segment.gradient_pct ?? 0) / 100;
  const velocity = calculateVelocity(
    profile.powerWatts,
    gradientDecimal,
    profile.riderWeightKg,
    profile.bikeWeightKg
  );
  if (!(velocity > 0)) return null;
  return (segment.distance_km * 1000) / velocity;
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
  if (!isFiltered) return segments;

  const profile = createIntervalProfile(filterPower, riderWeight, bikeWeight);
  const targetMinutes = parseIntervalMinutes(filterTimeMinutes);
  if (!profile || !targetMinutes) return segments;

  return segments.filter((segment) => passesIntervalFilter(segment, profile, targetMinutes, minRatio));
}

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
