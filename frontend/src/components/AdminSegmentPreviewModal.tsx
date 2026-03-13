"use client";

import { useEffect, useState } from "react";
import InteractiveMap from "@/components/Map";
import type { Segment } from "@/types";

interface AdminSegmentPreviewModalProps {
  segment: Segment | null;
  onClose: () => void;
}

export default function AdminSegmentPreviewModal({ segment, onClose }: AdminSegmentPreviewModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!segment) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [segment, onClose]);

  if (!segment) return null;

  return (
    <div className={`fixed inset-0 z-[7500] flex ${isFullscreen ? "items-stretch justify-stretch p-0" : "items-center justify-center p-4"}`}>
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close segment preview"
        onClick={onClose}
      />
      <div className={`relative w-full border border-neutral-200 bg-white shadow-2xl overflow-hidden ${isFullscreen ? "h-full rounded-none max-w-none" : "max-w-6xl rounded-2xl"}`}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 bg-white/95">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Segment Preview</h2>
            <p className="text-xs text-neutral-500">{segment.name || "Unnamed Segment"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="inline-flex items-center rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              {isFullscreen ? "Exit Full Screen" : "Full Screen"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Close
            </button>
          </div>
        </div>
        <div className={isFullscreen ? "h-[calc(100%-52px)]" : "h-[min(78vh,680px)]"}>
          <InteractiveMap
            key={segment.id || segment.strava_id || segment.name}
            segments={[segment]}
            focusSegmentId={segment.id}
            autoSelectFocusedSegment={true}
            persistViewport={false}
          />
        </div>
      </div>
    </div>
  );
}
