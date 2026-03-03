"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Plus, Compass, Activity, Wind, ListFilter, Mountain } from "lucide-react";
import type { Segment } from "@/types";
import SubmissionForm from "@/components/SubmissionForm";
import { fetchSegments } from "@/utils/api";

// Dynamically import Map with SSR disabled since maplibre relies on window object
const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-100/50 rounded-2xl animate-pulse">
      <Compass className="w-14 h-14 text-neutral-300 animate-[spin_3s_linear_infinite] mb-4" />
      <span className="text-neutral-400 font-medium tracking-wide">Loading map data...</span>
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

  return (
    <main className="flex h-[100dvh] w-full flex-col md:flex-row bg-[#f9fafb] overflow-hidden">
      {/* Sidebar UI */}
      <aside className="w-full md:w-[420px] h-auto md:h-full bg-white shadow-[8px_0_30px_rgba(0,0,0,0.03)] z-10 flex flex-col relative shrink-0">

        {/* Header Section */}
        <div className="p-8 pb-6 border-b border-neutral-100/80 bg-white/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-gradient-to-br from-rose-400 to-rose-600 text-white p-2.5 rounded-xl shadow-lg shadow-rose-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black text-neutral-900 tracking-tight">
              FindMy<span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-500">Intervals</span>
            </h1>
          </div>
          <p className="text-[15px] text-neutral-500 font-medium leading-relaxed">
            Discover uninterrupted roads for structured interval training.
          </p>
        </div>

        {/* Filters & Action */}
        <div className="p-8 flex flex-col gap-8 flex-1 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 text-[13px] uppercase tracking-widest font-bold text-neutral-400 mb-4">
              <ListFilter className="w-4 h-4" />
              Filter by Terrain
            </div>

            <div className="flex gap-2 p-1 bg-neutral-100/80 rounded-2xl">
              <button
                onClick={() => setActiveFilter("All")}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${activeFilter === "All"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5"
                  }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter("Hilly")}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeFilter === "Hilly"
                  ? "bg-white text-rose-600 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5"
                  }`}
              >
                <Mountain className="w-4 h-4" />
                Hilly
              </button>
              <button
                onClick={() => setActiveFilter("Flat")}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeFilter === "Flat"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 hover:bg-black/5"
                  }`}
              >
                <Wind className="w-4 h-4" />
                Flat
              </button>
            </div>
          </div>

          <hr className="border-neutral-100/80" />

          {/* About / CTA */}
          <div className="mt-auto pt-4 bg-gradient-to-b from-blue-50/50 to-blue-50/20 border border-blue-100/60 p-6 rounded-3xl flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
              <Compass className="w-24 h-24 text-blue-600" />
            </div>
            <div className="relative z-10">
              <h3 className="font-black text-blue-900 text-lg mb-2">Contribute a Route</h3>
              <p className="text-sm text-blue-800/70 leading-relaxed font-medium mb-5">
                Help the cycling community by crowdsourcing safe, traffic-free segments perfect for high-speed VO2 Max or Threshold efforts.
              </p>
              <button
                onClick={() => setShowSubmissionContent(true)}
                className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-5 h-5" />
                Submit Segment
              </button>
            </div>
          </div>
        </div>

      </aside>

      {/* Main Map Viewport */}
      <section className="flex-1 h-[60vh] md:h-full p-2 md:p-6 bg-neutral-100/50 relative">
        {error && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[5000] bg-red-50/90 backdrop-blur-md border border-red-200 text-red-700 px-6 py-4 rounded-2xl shadow-xl max-w-sm w-[90%] text-center animate-in slide-in-from-top-4 fade-in duration-300">
            <p className="font-bold text-sm flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              {error}
            </p>
          </div>
        )}

        {!error && !loading && segments.length === 0 && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[5000] bg-amber-50/90 backdrop-blur-md border border-amber-200 text-amber-800 px-6 py-4 rounded-2xl shadow-xl max-w-sm w-[90%] text-center animate-in slide-in-from-top-4 fade-in duration-300">
            <p className="font-bold text-sm">No intervals currently in the database. Be the first to add one!</p>
          </div>
        )}

        <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-neutral-200/60 bg-white">
          <Map segments={segments} activeFilter={activeFilter} />
        </div>

        {/* Floating Modal Overlay for Form */}
        {showSubmissionContent && (
          <div className="absolute inset-0 z-[9999] bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <SubmissionForm onClose={() => setShowSubmissionContent(false)} />
          </div>
        )}
      </section>
    </main>
  );
}
