import { matchesAdminFilters } from "@/hooks/adminFilters";
import type { Segment } from "@/types";

const baseSegment: Segment = {
  id: "segment-1",
  name: "Alpine Climb",
  strava_id: "12345",
  strava_url: "https://www.strava.com/segments/12345",
  distance_km: 7.2,
  gradient_pct: 5.6,
  approved: true,
  blocked: false,
  created_at: "2026-03-01T12:00:00Z",
  completion_times: {
    beginner: "30:00",
    intermediate: "25:00",
    advanced: "20:00",
  },
  reported_by_actor_ids: [],
  reported_by_users: [],
};

describe("matchesAdminFilters", () => {
  it("matches segment with all filters and empty query", () => {
    expect(
      matchesAdminFilters(baseSegment, {
        approval: "all",
        block: "all",
        report: "all",
        query: "",
      })
    ).toBe(true);
  });

  it("filters by approval state", () => {
    expect(
      matchesAdminFilters(baseSegment, {
        approval: "approved",
        block: "all",
        report: "all",
        query: "",
      })
    ).toBe(true);

    expect(
      matchesAdminFilters(baseSegment, {
        approval: "pending",
        block: "all",
        report: "all",
        query: "",
      })
    ).toBe(false);
  });

  it("filters by block state", () => {
    const blockedSegment: Segment = { ...baseSegment, blocked: true };

    expect(
      matchesAdminFilters(blockedSegment, {
        approval: "all",
        block: "blocked",
        report: "all",
        query: "",
      })
    ).toBe(true);

    expect(
      matchesAdminFilters(blockedSegment, {
        approval: "all",
        block: "unblocked",
        report: "all",
        query: "",
      })
    ).toBe(false);
  });

  it("filters by report state", () => {
    const reportedSegment: Segment = {
      ...baseSegment,
      reported_by_actor_ids: ["actor-1"],
      reported_by_users: [{ actor_id: "actor-1" }],
    };

    expect(
      matchesAdminFilters(reportedSegment, {
        approval: "all",
        block: "all",
        report: "reported",
        query: "",
      })
    ).toBe(true);

    expect(
      matchesAdminFilters(reportedSegment, {
        approval: "all",
        block: "all",
        report: "not_reported",
        query: "",
      })
    ).toBe(false);
  });

  it("matches case-insensitive search corpus", () => {
    const segmentWithReporter: Segment = {
      ...baseSegment,
      reported_by_actor_ids: ["abc123"],
      reported_by_users: [{ actor_id: "reporter-99" }],
    };

    expect(
      matchesAdminFilters(segmentWithReporter, {
        approval: "all",
        block: "all",
        report: "all",
        query: "reporter-99",
      })
    ).toBe(true);

    expect(
      matchesAdminFilters(segmentWithReporter, {
        approval: "all",
        block: "all",
        report: "all",
        query: "ALPINE".toLowerCase(),
      })
    ).toBe(true);

    expect(
      matchesAdminFilters(segmentWithReporter, {
        approval: "all",
        block: "all",
        report: "all",
        query: "non-existent",
      })
    ).toBe(false);
  });
});
