import type { SegmentRatingValues } from "@/types";

export type NullableSegmentRatings = {
  [K in keyof SegmentRatingValues]: number | null;
};

type ChoiceOption = {
  value: number;
  label: string;
};

type RatingFieldConfig = {
  key: keyof SegmentRatingValues;
  label: string;
  min: number;
  max: number;
  input: "stars" | "choice";
  options?: ChoiceOption[];
};

const TRAFFIC_LEVEL_OPTIONS: ChoiceOption[] = [
  { value: 1, label: "Low" },
  { value: 2, label: "Med" },
  { value: 3, label: "High" },
];

const ROAD_SURFACE_OPTIONS: ChoiceOption[] = [
  { value: 1, label: "Bad" },
  { value: 2, label: "Patchy" },
  { value: 3, label: "Smooth" },
];

const GRADIENT_PROFILE_OPTIONS: ChoiceOption[] = [
  { value: 1, label: "Rolling" },
  { value: 2, label: "Flowing" },
  { value: 3, label: "Steady" },
];

const SKETCHY_LEFT_TURNS_OPTIONS: ChoiceOption[] = [
  { value: 0, label: "0" },
  { value: 1, label: "1" },
  { value: 2, label: "2+" },
];

export const RATING_FIELDS: RatingFieldConfig[] = [
  { key: "overall_quality", label: "Overall Quality", min: 1, max: 10, input: "stars" },
  { key: "traffic_level", label: "Traffic Level", min: 1, max: 3, input: "choice", options: TRAFFIC_LEVEL_OPTIONS },
  { key: "road_surface", label: "Road Surface", min: 1, max: 3, input: "choice", options: ROAD_SURFACE_OPTIONS },
  { key: "gradient_profile", label: "Gradient Profile", min: 1, max: 3, input: "choice", options: GRADIENT_PROFILE_OPTIONS },
  { key: "sketchy_left_turns", label: "Sketchy Left Turns", min: 0, max: 2, input: "choice", options: SKETCHY_LEFT_TURNS_OPTIONS },
];

export const DEFAULT_RATING_INPUT: NullableSegmentRatings = {
  overall_quality: null,
  traffic_level: null,
  road_surface: null,
  gradient_profile: null,
  sketchy_left_turns: null,
};

function clampRatingValue(fieldKey: keyof SegmentRatingValues, value: number): number {
  const field = RATING_FIELDS.find((entry) => entry.key === fieldKey);
  if (!field) return value;
  return Math.max(field.min, Math.min(field.max, value));
}

export function getChoiceLabel(fieldKey: keyof SegmentRatingValues, value: number): string {
  const field = RATING_FIELDS.find((entry) => entry.key === fieldKey);
  const normalized = clampRatingValue(fieldKey, Math.round(value));
  const option = field?.options?.find((entry) => entry.value === normalized);
  if (option) return option.label;
  return String(normalized);
}

export function getRatingDisplay(fieldKey: keyof SegmentRatingValues, value: number | null | undefined): string {
  if (typeof value !== "number") return "N/A";
  if (fieldKey === "overall_quality") return `${value.toFixed(1)}/10`;
  return getChoiceLabel(fieldKey, value);
}
