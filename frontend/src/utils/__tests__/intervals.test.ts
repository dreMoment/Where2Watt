import {
  createIntervalProfile,
  estimateSegmentDurationSeconds,
  filterSegmentsByInterval,
  formatDuration,
  getIntervalMarginRatio,
  parseIntervalMinutes,
  passesIntervalFilter,
} from "@/utils/intervals";
import type { Segment } from "@/types";

describe("intervals utils", () => {
  const sampleSegment: Segment = {
    id: "s1",
    name: "Test",
    distance_km: 2,
    gradient_pct: 4,
    completion_times: { beginner: "10:00", intermediate: "08:00", advanced: "06:00" },
    strava_url: "https://www.strava.com/segments/1",
    approved: true,
    blocked: false,
  };

  it("parses and validates interval minutes", () => {
    expect(parseIntervalMinutes("5")).toBe(5);
    expect(parseIntervalMinutes(10)).toBe(10);
    expect(parseIntervalMinutes("0")).toBeNull();
    expect(parseIntervalMinutes("abc")).toBeNull();
  });

  it("creates profile with defaults for invalid weights", () => {
    expect(createIntervalProfile("300", undefined, 0)).toEqual({
      powerWatts: 300,
      riderWeightKg: 75,
      bikeWeightKg: 9,
    });
    expect(createIntervalProfile("0", 70, 8)).toBeNull();
  });

  it("estimates duration and computes margin ratio", () => {
    const profile = createIntervalProfile(280, 72, 8)!;
    const seconds = estimateSegmentDurationSeconds(sampleSegment, profile);
    expect(seconds).not.toBeNull();
    expect((seconds as number) > 0).toBe(true);
    expect(getIntervalMarginRatio(sampleSegment, profile, 5)).not.toBeNull();
  });

  it("sums time over the elevation profile when available", () => {
    const profile = createIntervalProfile(250, 75, 9)!;
    // 2 km at 4 % on average: 1 km flat, then 1 km at 8 %.
    const stepped: Segment = {
      ...sampleSegment,
      elevation_profile: [
        [0, 100],
        [1000, 100],
        [2000, 180],
      ],
    };
    const evenSeconds = estimateSegmentDurationSeconds(sampleSegment, profile)!;
    const steppedSeconds = estimateSegmentDurationSeconds(stepped, profile)!;
    const flatHalf = estimateSegmentDurationSeconds({ distance_km: 1, gradient_pct: 0 }, profile)!;
    const steepHalf = estimateSegmentDurationSeconds({ distance_km: 1, gradient_pct: 8 }, profile)!;

    expect(steppedSeconds).toBeCloseTo(flatHalf + steepHalf, 6);
    expect(steppedSeconds).toBeGreaterThan(evenSeconds);
  });

  it("scales the profile to the segment distance and ignores unusable profiles", () => {
    const profile = createIntervalProfile(250, 75, 9)!;
    const evenSeconds = estimateSegmentDurationSeconds(sampleSegment, profile)!;
    const scaled: Segment = { ...sampleSegment, elevation_profile: [[0, 0], [1000, 40]] };
    expect(estimateSegmentDurationSeconds(scaled, profile)).toBeCloseTo(evenSeconds, 6);

    for (const elevation_profile of [null, [], [[0, 10]], [[5, 10], [5, 20]]] as Segment["elevation_profile"][]) {
      expect(estimateSegmentDurationSeconds({ ...sampleSegment, elevation_profile }, profile)).toBeCloseTo(evenSeconds, 6);
    }
  });

  it("estimates downhill segments", () => {
    const profile = createIntervalProfile(350, 75, 9)!;
    const seconds = estimateSegmentDurationSeconds({ distance_km: 2, gradient_pct: -3 }, profile);
    expect(seconds).toBeGreaterThan(0);
  });

  it("applies filter rules including blocked segments", () => {
    const profile = createIntervalProfile(280, 72, 8)!;
    expect(passesIntervalFilter({ ...sampleSegment, blocked: true }, profile, 5)).toBe(false);

    const unblocked = passesIntervalFilter({ ...sampleSegment, blocked: false }, profile, 1);
    expect(unblocked).toBe(true);
  });

  it("returns unfiltered data when filter input is invalid", () => {
    const segments = [sampleSegment];
    expect(
      filterSegmentsByInterval(segments, {
        isFiltered: true,
        filterPower: "bad",
        filterTimeMinutes: 5,
        riderWeight: 70,
        bikeWeight: 8,
      })
    ).toEqual(segments);
  });

  it("formats durations safely", () => {
    expect(formatDuration(undefined)).toBe("--:--");
    expect(formatDuration(0)).toBe("--:--");
    expect(formatDuration(61)).toBe("1:01");
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});
