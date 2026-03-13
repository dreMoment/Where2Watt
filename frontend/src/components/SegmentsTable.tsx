import { Fragment } from "react";
import type { Segment, SegmentAdminRating, UserSummary } from "@/types";
import type { Tab } from "@/hooks/useAdminSegments";
import { getRatingDisplay } from "@/constants/ratings";

function timeAgo(dateString?: string): string {
  if (!dateString) return "Unknown date";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function shortAgentId(actorId: string): string {
  return actorId.slice(0, 8);
}

function getUserLabel(user?: UserSummary | null, fallbackId?: string | null): string {
  if (user) {
    return `a_${shortAgentId(user.actor_id)}`;
  }
  if (typeof fallbackId === "string" && fallbackId.length > 0) return `a_${shortAgentId(fallbackId)}`;
  return "Unknown";
}

function getSubmitterLabel(): string {
  return "Anonymous";
}

function formatReportSentAt(dateString?: string | null): string {
  const formatted = formatDate(dateString);
  return formatted === "-" ? "Unknown date" : formatted;
}

interface SegmentsTableProps {
  activeTab: Tab;
  currentLoading: boolean;
  currentError: string;
  currentSegments: Segment[];
  filteredSegments: Segment[];
  expandedRatingsSegmentId: string | null;
  segmentRatingsById: Record<string, SegmentAdminRating[]>;
  segmentRatingsLoadingById: Record<string, boolean>;
  segmentRatingsErrorById: Record<string, string>;
  onDelete: (id: string, name: string) => void;
  onApprove: (id: string) => void;
  onBlock: (id: string) => void;
  onUnblock: (id: string) => void;
  onToggleRatings: (segmentId: string) => void;
  onDeleteRating: (segmentId: string, ratingId: string) => void;
  onPreview: (segment: Segment) => void;
}

export default function SegmentsTable({
  activeTab,
  currentLoading,
  currentError,
  currentSegments,
  filteredSegments,
  expandedRatingsSegmentId,
  segmentRatingsById,
  segmentRatingsLoadingById,
  segmentRatingsErrorById,
  onDelete,
  onApprove,
  onBlock,
  onUnblock,
  onToggleRatings,
  onDeleteRating,
  onPreview,
}: SegmentsTableProps) {
  if (currentLoading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-medium">Loading segments...</p>
      </div>
    );
  }

  if (currentError) {
    return (
      <div className="p-16 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <p className="text-red-400 font-medium mb-2">Error loading segments</p>
        <p className="text-sm text-gray-500">{currentError}</p>
      </div>
    );
  }

  if (currentSegments.length === 0) {
    return (
      <div className="p-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-2">{activeTab === "pending" ? "No pending segments" : "No segments found"}</h3>
        <p className="text-gray-400">
          {activeTab === "pending"
            ? "All segments have been reviewed. Check back later for new submissions."
            : "There are currently no segments in the database."}
        </p>
      </div>
    );
  }

  if (filteredSegments.length === 0) {
    return (
      <div className="p-16 text-center">
        <h3 className="text-lg font-medium text-white mb-2">No segments match the current filters</h3>
        <p className="text-gray-400">Adjust search or filters to broaden the results.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider font-semibold">
            <th className="p-5 pl-6">Segment</th>
            <th className="p-5">Distance</th>
            <th className="p-5">Gradient</th>
            <th className="p-5">Status</th>
            <th className="p-5">Strava ID</th>
            <th className="p-5">Submitted By</th>
            <th className="p-5">Reported By</th>
            <th className="p-5">Created</th>
            <th className="p-5">Ratings</th>
            <th className="p-5 pr-6 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {filteredSegments.map((segment) => {
            const reportQueueEntries = segment.block_reports || [];
            const reportedUsers = segment.reported_by_users || [];
            const reporterEntries =
              reportedUsers.length > 0
                ? reportedUsers.map((u) => ({ label: getUserLabel(u), fullId: u.actor_id }))
                : segment.reported_by_actor_ids && segment.reported_by_actor_ids.length > 0
                  ? segment.reported_by_actor_ids.map((id) => ({ label: getUserLabel(undefined, id), fullId: id }))
                  : [];
            const segmentId = segment.id;
            const ratingsCount = segment.ratings_count ?? 0;
            const isRatingsExpanded = !!segmentId && expandedRatingsSegmentId === segmentId;
            const ratings = segmentId ? segmentRatingsById[segmentId] || [] : [];
            const ratingsLoading = segmentId ? !!segmentRatingsLoadingById[segmentId] : false;
            const ratingsError = segmentId ? segmentRatingsErrorById[segmentId] || "" : "";

            return (
              <Fragment key={segment.id || segment.strava_id || segment.name}>
                <tr className="hover:bg-gray-800/50 transition-colors group">
                  <td className="p-5 pl-6">
                    <div className="font-medium text-white">{segment.name || "Unnamed Segment"}</div>
                    <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                      <span>ID: {segment.id}</span>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="inline-flex items-center px-2.5 py-1 rounded bg-gray-800 text-blue-400 font-medium text-sm">{segment.distance_km ?? "-"} km</div>
                  </td>
                  <td className="p-5">
                    <div className="inline-flex items-center px-2.5 py-1 rounded bg-gray-800 text-emerald-400 font-medium text-sm">{segment.gradient_pct ?? "-"}%</div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col gap-1.5">
                      {segment.approved ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          Pending
                        </span>
                      )}
                      {segment.blocked && (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold border border-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                            Blocked
                          </span>
                          {segment.block_message && segment.block_message.trim().length > 0 && (
                            <div className="max-w-[260px] text-[11px] leading-4 text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-2 py-1">
                              {segment.block_message}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-5">
                    {segment.strava_id ? (
                      <a
                        href={`https://www.strava.com/segments/${segment.strava_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-orange-400 flex items-center gap-1.5 transition-colors text-sm"
                      >
                        View on Strava
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    ) : (
                      <span className="text-gray-600 text-sm">N/A</span>
                    )}
                  </td>
                  <td className="p-5 text-sm text-gray-300">
                    {getSubmitterLabel()}
                  </td>
                  <td className="p-5 text-sm text-gray-300 max-w-[420px] whitespace-normal">
                    {reportQueueEntries.length > 0 ? (
                      <div className="space-y-1.5">
                        {reportQueueEntries.slice(0, 3).map((entry, index) => (
                          <div key={`${segment.id}-${entry.reported_by_actor_id}-${entry.reported_at}-${index}`} className="rounded-md bg-gray-800 border border-gray-700 p-2">
                            <div className="text-xs text-gray-200 font-medium">
                              {getUserLabel(undefined, entry.reported_by_actor_id)} · {formatReportSentAt(entry.reported_at)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {entry.note && entry.note.trim().length > 0 ? entry.note : "No note"}
                            </div>
                          </div>
                        ))}
                        {reportQueueEntries.length > 3 && (
                          <div className="text-xs text-gray-500">+{reportQueueEntries.length - 3} more</div>
                        )}
                      </div>
                    ) : (
                      reporterEntries.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {reporterEntries.map(({ label, fullId }) => (
                            <span
                              key={`${segment.id}-${fullId}`}
                              className="inline-flex items-center px-2 py-1 rounded-md bg-gray-800 text-gray-200 text-xs border border-gray-700"
                              title={fullId}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )
                    )}
                  </td>
                  <td className="p-5 text-sm text-gray-400">
                    <div>{formatDate(segment.created_at)}</div>
                    <div className="text-xs text-gray-500">{timeAgo(segment.created_at)}</div>
                  </td>
                  <td className="p-5">
                    <div className="space-y-2">
                      <div className="text-xs text-gray-300">
                        {ratingsCount} {ratingsCount === 1 ? "rating" : "ratings"}
                      </div>
                      {segmentId ? (
                        <button
                          onClick={() => onToggleRatings(segmentId)}
                          className="inline-flex items-center px-2.5 py-1 rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors text-xs font-semibold"
                        >
                          {isRatingsExpanded ? "Hide" : "Moderate"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">N/A</span>
                      )}
                    </div>
                  </td>
                  <td className="p-5 pr-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {activeTab === "pending" ? (
                        <button
                          onClick={() => onPreview(segment)}
                          className="inline-flex items-center px-4 py-2 bg-blue-500/10 text-blue-300 hover:bg-blue-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-10 5h8a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          Preview
                        </button>
                      ) : segment.blocked ? (
                        <button
                          onClick={() => segment.id && onUnblock(segment.id)}
                          className="inline-flex items-center px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                          Unblock
                        </button>
                      ) : (
                        <button
                          onClick={() => segment.id && onBlock(segment.id)}
                          className="inline-flex items-center px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          Block
                        </button>
                      )}
                      <button
                        onClick={() =>
                          segment.id && onDelete(segment.id, segment.name || segment.strava_id || segment.id || "Unknown Segment")
                        }
                        className="inline-flex items-center px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                      </button>
                      {activeTab === "pending" && (
                        <button
                          onClick={() => segment.id && onApprove(segment.id)}
                          className="inline-flex items-center px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Approve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isRatingsExpanded && segmentId && (
                  <tr className="bg-gray-900/60">
                    <td colSpan={10} className="px-6 py-4">
                      {ratingsLoading ? (
                        <div className="text-sm text-gray-400">Loading ratings...</div>
                      ) : ratingsError ? (
                        <div className="text-sm text-red-400">{ratingsError}</div>
                      ) : ratings.length === 0 ? (
                        <div className="text-sm text-gray-500">No ratings for this segment.</div>
                      ) : (
                        <div className="space-y-2">
                          {ratings.map((rating) => (
                            <div key={rating.id} className="rounded-md border border-gray-700 bg-gray-800/80 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs text-gray-200 font-medium">
                                  {getUserLabel(undefined, rating.rated_by_actor_id)} · {formatReportSentAt(rating.rated_at)}
                                </div>
                                <button
                                  onClick={() => onDeleteRating(segmentId, rating.id)}
                                  className="inline-flex items-center px-2.5 py-1 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors text-xs font-semibold"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-300">
                                <span>Overall Quality: {getRatingDisplay("overall_quality", rating.ratings.overall_quality)}</span>
                                <span>Traffic Level: {getRatingDisplay("traffic_level", rating.ratings.traffic_level)}</span>
                                <span>Road Surface: {getRatingDisplay("road_surface", rating.ratings.road_surface)}</span>
                                <span>Gradient Profile: {getRatingDisplay("gradient_profile", rating.ratings.gradient_profile)}</span>
                                <span>Sketchy Left Turns: {getRatingDisplay("sketchy_left_turns", rating.ratings.sketchy_left_turns)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
