"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Plus, Compass, Activity, Wind, ListFilter, Mountain } from "lucide-react";
import type { Segment } from "@/types";
import SubmissionForm from "@/components/SubmissionForm";

// Dynamically import Map with SSR disabled since Leaflet relies on window object
const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-100 rounded-xl animate-pulse">
      <Compass className="w-12 h-12 text-neutral-300 animate-spin-slow" />
    </div>
  ),
});

export default function Home() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeFilter, setActiveFilter] = useState<"All" | "Hilly" | "Flat">("All");
  const [showSubmissionContent, setShowSubmissionContent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:8080/api/segments")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
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

  return (
    <main className="flex h-screen w-full flex-col md:flex-row bg-[#f9fafb] overflow-hidden">
      {/* Sidebar UI */}
      <aside className="w-full md:w-[400px] h-auto md:h-full bg-white shadow-[4px_0_24px_rgba(0,0,0,0.04)] z-10 flex flex-col relative shrink-0">

        {/* Header Section */}
        <div className="p-6 pb-4 border-b border-neutral-100 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-rose-500 text-white p-1.5 rounded-lg shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
              FindMy<span className="text-rose-500">Intervals</span>
            </h1>
          </div>
          <p className="text-sm text-neutral-500 font-medium">
            Discover uninterrupted roads for structured interval training.
          </p>
        </div>

        {/* Filters & Action */}
        <div className="p-6 flex flex-col gap-5 flex-1 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800 mb-3">
              <ListFilter className="w-4 h-4 text-neutral-400" />
              Filter by Terrain
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveFilter("All")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${activeFilter === "All"
                  ? "bg-neutral-900 text-white shadow-md shadow-neutral-900/20"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter("Hilly")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${activeFilter === "Hilly"
                  ? "bg-rose-100 text-rose-700 shadow-sm border border-rose-200"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-transparent"
                  }`}
              >
                <Mountain className="w-4 h-4 opacity-70 hidden" />
                Hilly
              </button>
              <button
                onClick={() => setActiveFilter("Flat")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${activeFilter === "Flat"
                  ? "bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-transparent"
                  }`}
              >
                <Wind className="w-4 h-4 opacity-70 hidden" />
                Flat
              </button>
            </div>
          </div>

          <hr className="border-neutral-100" />

          {/* About / CTA */}
          <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl flex flex-col gap-3">
            <h3 className="font-bold text-blue-900 text-sm">Contribute a Route</h3>
            <p className="text-xs text-blue-700/80 leading-relaxed">
              Help the cycling community by crowdsourcing safe, traffic-free segments perfect for high-speed VO2 Max or Threshold efforts.
            </p>
            <button
              onClick={() => setShowSubmissionContent(true)}
              className="mt-1 flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              Submit Segment
            </button>
          </div>
        </div>

      </aside>

      {/* Main Map Viewport */}
      <section className="flex-1 h-[60vh] md:h-full p-2 md:p-4 bg-neutral-100/50 relative">
        {error && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[5000] bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl shadow-sm max-w-sm w-[90%] text-center">
            <p className="font-medium text-sm">{error}</p>
          </div>
        )}

        {!error && !loading && segments.length === 0 && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[5000] bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl shadow-sm max-w-sm w-[90%] text-center">
            <p className="font-medium text-sm">No intervals currently in the database. Be the first to add one!</p>
          </div>
        )}

        <Map segments={segments} activeFilter={activeFilter} />

        {/* Floating Modal Overlay for Form */}
        {showSubmissionContent && (
          <div className="absolute inset-0 z-[9999] bg-white/60 backdrop-blur-md flex items-center justify-center p-4">
            <SubmissionForm onClose={() => setShowSubmissionContent(false)} />
          </div>
        )}
      </section>
    </main>
  );
}
