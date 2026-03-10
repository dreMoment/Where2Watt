import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { deleteAdminSegmentRating, fetchAdminSegmentRatings } from "@/utils/api";
import type { Segment, SegmentAdminRating } from "@/types";
import { getErrorMessage, isAuthFailure } from "@/hooks/adminErrors";

type ConfirmDialogFn = (options: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}) => Promise<boolean>;

type ShowToastFn = (message: string, options?: { type?: "info" | "success" | "error" }) => void;

interface UseAdminRatingsModerationParams {
  token: string;
  onLogout: () => void;
  confirm: ConfirmDialogFn;
  showToast: ShowToastFn;
  setPendingSegments: Dispatch<SetStateAction<Segment[]>>;
  setAllSegments: Dispatch<SetStateAction<Segment[]>>;
}

export function useAdminRatingsModeration({
  token,
  onLogout,
  confirm,
  showToast,
  setPendingSegments,
  setAllSegments,
}: UseAdminRatingsModerationParams) {
  const [expandedRatingsSegmentId, setExpandedRatingsSegmentId] = useState<string | null>(null);
  const [segmentRatingsById, setSegmentRatingsById] = useState<Record<string, SegmentAdminRating[]>>({});
  const [segmentRatingsLoadingById, setSegmentRatingsLoadingById] = useState<Record<string, boolean>>({});
  const [segmentRatingsErrorById, setSegmentRatingsErrorById] = useState<Record<string, string>>({});

  const updateSegmentRatingStats = useCallback(
    (id: string, ratingsCount: number, averageRatings: Segment["average_ratings"]) => {
      const updater = (segment: Segment) =>
        segment.id === id
          ? { ...segment, ratings_count: ratingsCount, average_ratings: averageRatings }
          : segment;

      setPendingSegments((prev) => prev.map(updater));
      setAllSegments((prev) => prev.map(updater));
    },
    [setAllSegments, setPendingSegments]
  );

  const loadSegmentRatings = useCallback(
    async (segmentId: string, force = false) => {
      if (!force && segmentRatingsById[segmentId]) {
        return;
      }
      try {
        setSegmentRatingsLoadingById((prev) => ({ ...prev, [segmentId]: true }));
        setSegmentRatingsErrorById((prev) => ({ ...prev, [segmentId]: "" }));
        const ratings = await fetchAdminSegmentRatings(segmentId, token);
        setSegmentRatingsById((prev) => ({ ...prev, [segmentId]: ratings }));
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Failed to load ratings");
        setSegmentRatingsErrorById((prev) => ({ ...prev, [segmentId]: message }));
        if (isAuthFailure(message)) {
          onLogout();
        }
      } finally {
        setSegmentRatingsLoadingById((prev) => ({ ...prev, [segmentId]: false }));
      }
    },
    [onLogout, segmentRatingsById, token]
  );

  const handleToggleRatings = useCallback(
    (id: string) => {
      if (expandedRatingsSegmentId === id) {
        setExpandedRatingsSegmentId(null);
        return;
      }
      setExpandedRatingsSegmentId(id);
      loadSegmentRatings(id);
    },
    [expandedRatingsSegmentId, loadSegmentRatings]
  );

  const handleDeleteRating = useCallback(
    async (segmentId: string, ratingId: string) => {
      const confirmed = await confirm({
        title: "Remove rating?",
        description: "This rating will be permanently deleted and segment averages will be recalculated.",
        confirmLabel: "Remove",
        cancelLabel: "Cancel",
        tone: "danger",
      });
      if (!confirmed) {
        return;
      }

      try {
        const result = await deleteAdminSegmentRating(segmentId, ratingId, token);
        setSegmentRatingsById((prev) => ({
          ...prev,
          [segmentId]: (prev[segmentId] || []).filter((rating) => rating.id !== ratingId),
        }));
        updateSegmentRatingStats(segmentId, result.ratings_count, result.average_ratings);
        showToast("Rating removed", { type: "info" });
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Failed to delete rating");
        showToast(message, { type: "error" });
        if (isAuthFailure(message)) {
          onLogout();
        }
      }
    },
    [confirm, onLogout, showToast, token, updateSegmentRatingStats]
  );

  return {
    expandedRatingsSegmentId,
    segmentRatingsById,
    segmentRatingsLoadingById,
    segmentRatingsErrorById,
    handleToggleRatings,
    handleDeleteRating,
  };
}
