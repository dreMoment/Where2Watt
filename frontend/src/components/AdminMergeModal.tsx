"use client";

import { useEffect, useMemo, useState } from "react";
import type { Segment } from "@/types";

interface AdminMergeModalProps {
  open: boolean;
  sourceSegment: Segment | null;
  targetSegments: Segment[];
  loadingTargets?: boolean;
  onClose: () => void;
  onConfirm: (targetSegmentId: string) => Promise<void> | void;
}

export default function AdminMergeModal({
  open,
  sourceSegment,
  targetSegments,
  loadingTargets = false,
  onClose,
  onConfirm,
}: AdminMergeModalProps) {
  const [targetSegmentId, setTargetSegmentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTargetSegmentId("");
      setIsSubmitting(false);
      return;
    }
    const firstTarget = targetSegments[0]?.id || "";
    setTargetSegmentId(firstTarget);
  }, [open, targetSegments]);

  const hasTargets = targetSegments.length > 0;
  const sourceLabel = useMemo(() => {
    if (!sourceSegment) {
      return "";
    }
    const name = sourceSegment.name || "Unnamed Segment";
    const sourceId = sourceSegment.id || "unknown";
    const sourceStravaId = sourceSegment.strava_id || "n/a";
    return `${name} (ID: ${sourceId}, Strava: ${sourceStravaId})`;
  }, [sourceSegment]);

  if (!open || !sourceSegment) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[7600] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close merge dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl"
      >
        <h2 className="text-lg font-bold text-neutral-900">Merge Segment</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Source: <span className="font-semibold text-neutral-800">{sourceLabel}</span>
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          All ratings from the source segment will move to the selected target segment.
        </p>

        <div className="mt-5">
          <label htmlFor="merge-target-segment" className="mb-1 block text-sm font-semibold text-neutral-700">
            Merge Into
          </label>
          {loadingTargets ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
              Loading segment list...
            </div>
          ) : hasTargets ? (
            <select
              id="merge-target-segment"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-300"
              value={targetSegmentId}
              onChange={(event) => setTargetSegmentId(event.target.value)}
            >
              {targetSegments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {(segment.name || "Unnamed Segment")} | ID: {segment.id} | Strava: {segment.strava_id || "n/a"}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No target segments are available.
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loadingTargets || !hasTargets || !targetSegmentId || isSubmitting}
            onClick={async () => {
              if (!targetSegmentId || isSubmitting) {
                return;
              }
              setIsSubmitting(true);
              try {
                await onConfirm(targetSegmentId);
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            {isSubmitting ? "Merging..." : "Merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
