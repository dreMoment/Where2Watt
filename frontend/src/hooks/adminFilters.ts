import type { Segment } from "@/types";

export type AdminApprovalFilter = "all" | "approved" | "pending";
export type AdminBlockFilter = "all" | "blocked" | "unblocked";
export type AdminReportFilter = "all" | "reported" | "not_reported";

export type AdminFilters = {
  approval: AdminApprovalFilter;
  block: AdminBlockFilter;
  report: AdminReportFilter;
  query: string;
};

function buildSearchCorpus(segment: Segment): string {
  const reportedIds = (segment.reported_by_actor_ids || []).join(" ");
  const reportedNames = (segment.reported_by_users || []).map((user) => user.actor_id).join(" ");

  return [
    segment.id,
    segment.name,
    segment.strava_id,
    segment.strava_url,
    segment.created_at,
    reportedIds,
    reportedNames,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesAdminFilters(segment: Segment, filters: AdminFilters): boolean {
  const reportCount = segment.reported_by_actor_ids?.length ?? 0;
  const isApproved = !!segment.approved;
  const isBlocked = !!segment.blocked;

  if (filters.approval === "approved" && !isApproved) {
    return false;
  }

  if (filters.approval === "pending" && isApproved) {
    return false;
  }

  if (filters.block === "blocked" && !isBlocked) {
    return false;
  }

  if (filters.block === "unblocked" && isBlocked) {
    return false;
  }

  if (filters.report === "reported" && reportCount === 0) {
    return false;
  }

  if (filters.report === "not_reported" && reportCount > 0) {
    return false;
  }

  if (!filters.query) {
    return true;
  }

  return buildSearchCorpus(segment).includes(filters.query);
}
