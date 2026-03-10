"use client";

import dynamic from "next/dynamic";
import { Compass } from "lucide-react";
import type { Segment, SegmentAverageRatings } from "@/types";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-100/50 rounded-2xl animate-pulse">
      <Compass className="w-14 h-14 text-neutral-300 animate-[spin_3s_linear_infinite] mb-4" />
      <span className="text-neutral-400 font-medium tracking-wide">Loading map data...</span>
    </div>
  ),
});

interface HomeMapPanelProps {
  error: string | null;
  loading: boolean;
  totalSegmentsCount: number;
  filteredSegments: Segment[];
  riderPower: string;
  riderWeight: string;
  bikeWeight: string;
  isFiltered: boolean;
  filterPower: string;
  filterTime: string;
  onSegmentBlocked: (segmentId: string, report: { blocked: boolean }) => void;
  onSegmentRated: (
    segmentId: string,
    rating: { ratings_count: number; average_ratings: SegmentAverageRatings }
  ) => void;
}

export default function HomeMapPanel({
  error,
  loading,
  totalSegmentsCount,
  filteredSegments,
  riderPower,
  riderWeight,
  bikeWeight,
  isFiltered,
  filterPower,
  filterTime,
  onSegmentBlocked,
  onSegmentRated,
}: HomeMapPanelProps) {
  return (
    <>
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[5000] bg-red-50/90 backdrop-blur-md border border-red-200 text-red-700 px-6 py-4 shadow-xl max-w-sm w-[90%] text-center animate-in slide-in-from-top-4 fade-in duration-300">
          <p className="font-bold text-sm flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            {error}
          </p>
        </div>
      )}

      {!error && !loading && totalSegmentsCount === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[5000] bg-amber-50/90 backdrop-blur-md border border-amber-200 text-amber-800 px-6 py-4 rounded-2xl shadow-xl max-w-sm w-[90%] text-center animate-in slide-in-from-top-4 fade-in duration-300">
          <p className="font-bold text-sm">No intervals currently in the database. Be the first to add one!</p>
        </div>
      )}

      <div className="w-full h-full overflow-hidden bg-white">
        <Map
          segments={filteredSegments}
          riderPower={riderPower}
          riderWeight={riderWeight}
          bikeWeight={bikeWeight}
          isFiltered={isFiltered}
          filterPower={filterPower}
          filterTime={filterTime}
          onSegmentBlocked={onSegmentBlocked}
          onSegmentRated={onSegmentRated}
        />
      </div>
    </>
  );
}