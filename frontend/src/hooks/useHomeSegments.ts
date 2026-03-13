import { useCallback, useEffect, useState } from "react";
import type { Segment, SegmentAverageRatings } from "@/types";
import { fetchSegments } from "@/utils/api";

interface SegmentRatingUpdate {
  ratings_count: number;
  average_ratings: SegmentAverageRatings;
}

export function useHomeSegments() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial public segment load for the map/list landing view.
    fetchSegments()
      .then((data) => {
        setSegments(data);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to fetch segments:", err);
        setError("Could not connect to the database. Please try again later.");
        setLoading(false);
      });
  }, []);

  // Applies local blocked/unblocked status updates after a report action.
  const handleSegmentBlocked = useCallback((segmentId: string, report: { blocked: boolean }) => {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === segmentId
          ? {
            ...segment,
            blocked: report.blocked,
          }
          : segment
      )
    );
  }, []);

  // Applies local aggregate rating updates after a vote create/delete.
  const handleSegmentRated = useCallback((segmentId: string, rating: SegmentRatingUpdate) => {
    setSegments((prev) =>
      prev.map((segment) =>
        segment.id === segmentId
          ? {
            ...segment,
            ratings_count: rating.ratings_count,
            average_ratings: rating.average_ratings,
          }
          : segment
      )
    );
  }, []);

  return {
    error,
    handleSegmentBlocked,
    handleSegmentRated,
    loading,
    segments,
  };
}
