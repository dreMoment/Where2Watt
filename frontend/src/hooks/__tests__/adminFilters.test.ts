import { matchesAdminFilters, type AdminFilters } from "@/hooks/adminFilters";
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

const blockedSegment: Segment = { ...baseSegment, blocked: true };
const reportedSegment: Segment = {
  ...baseSegment,
  reported_by_actor_ids: ["actor-1"],
  reported_by_users: [{ actor_id: "actor-1" }],
};

const filters = (overrides: Partial<AdminFilters> = {}): AdminFilters => ({
  approval: "all",
  block: "all",
  report: "all",
  query: "",
  ...overrides,
});

describe("matchesAdminFilters", () => {
  it.each([
    ["all filters, empty query", baseSegment, {}, true],
    ["approval=approved on approved segment", baseSegment, { approval: "approved" }, true],
    ["approval=pending on approved segment", baseSegment, { approval: "pending" }, false],
    ["block=blocked on blocked segment", blockedSegment, { block: "blocked" }, true],
    ["block=unblocked on blocked segment", blockedSegment, { block: "unblocked" }, false],
    ["report=reported on reported segment", reportedSegment, { report: "reported" }, true],
    ["report=not_reported on reported segment", reportedSegment, { report: "not_reported" }, false],
  ] as const)("%s -> %s", (_case, segment, overrides, expected) => {
    expect(matchesAdminFilters(segment, filters(overrides))).toBe(expected);
  });

  // The hook lowercases the query (useAdminSegments.ts), so this function expects a lowercase query.
  it("matches a lowercase query against mixed-case fields", () => {
    const segmentWithReporter: Segment = {
      ...baseSegment,
      reported_by_actor_ids: ["abc123"],
      reported_by_users: [{ actor_id: "reporter-99" }],
    };

    expect(matchesAdminFilters(segmentWithReporter, filters({ query: "reporter-99" }))).toBe(true);
    expect(matchesAdminFilters(segmentWithReporter, filters({ query: "alpine" }))).toBe(true);
    expect(matchesAdminFilters(segmentWithReporter, filters({ query: "non-existent" }))).toBe(false);
  });
});
