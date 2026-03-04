"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Plus, Compass, Activity } from "lucide-react";
import type { Segment } from "@/types";
import SubmissionForm from "@/components/SubmissionForm";
import InputField from "@/components/InputField";
import SectionCard from "@/components/SectionCard";
import { fetchSegments } from "@/utils/api";
import { calculateVelocity } from "@/utils/physics";

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
  const [showSubmissionContent, setShowSubmissionContent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [powerStr, setPowerStr] = useState("250");
  const [weightStr, setWeightStr] = useState("75");
  const [bikeWeightStr, setBikeWeightStr] = useState("9");

  // Filter state
  const [filterPowerStr, setFilterPowerStr] = useState("250");
  const [filterTimeStr, setFilterTimeStr] = useState("5"); // in minutes
  const [isFiltered, setIsFiltered] = useState(false);

  useEffect(() => {
    const p = localStorage.getItem("plannedPower");
    const w = localStorage.getItem("riderWeight");
    const bw = localStorage.getItem("bikeWeight");
    if (p) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPowerStr(p);
      setFilterPowerStr(p);
    }
    if (w) setWeightStr(w);
    if (bw) setBikeWeightStr(bw);
  }, []);

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWeightStr(e.target.value);
    localStorage.setItem("riderWeight", e.target.value);
  };

  const handleBikeWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBikeWeightStr(e.target.value);
    localStorage.setItem("bikeWeight", e.target.value);
  };

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

  const filteredSegments = useMemo(() => {
    if (!isFiltered) return segments;
    const filterPwr = parseFloat(filterPowerStr);
    const targetTimeSec = parseFloat(filterTimeStr) * 60;
    const rw = parseFloat(weightStr) || 75;
    const bw = parseFloat(bikeWeightStr) || 9;

    if (!filterPwr || !targetTimeSec) return segments;

    return segments.filter((seg) => {
      if (!seg.distance_km) return false;
      const gradientDecimal = (seg.gradient_pct ?? 0) / 100;
      const velocity = calculateVelocity(filterPwr, gradientDecimal, rw, bw);
      if (velocity <= 0) return false;
      const distMeters = seg.distance_km * 1000;
      const timeSec = distMeters / velocity;
      return timeSec >= targetTimeSec * 0.95;
    });
  }, [segments, isFiltered, filterPowerStr, filterTimeStr, weightStr, bikeWeightStr]);

  const handleSegmentBlocked = useCallback((segmentId: string, blockedUntil?: string) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === segmentId ? { ...s, blocked: true, blocked_until: blockedUntil } : s
      )
    );
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

        {/* Rider Profile Configuration */}
        <SectionCard title="Rider Profile">
          <InputField
            id="global-weight"
            label="Rider (kg)"
            type="number"
            min="0"
            value={weightStr}
            onChange={handleWeightChange}
            placeholder="e.g. 75"
          />
          <InputField
            id="global-bike-weight"
            label="Bike (kg)"
            type="number"
            min="0"
            value={bikeWeightStr}
            onChange={handleBikeWeightChange}
            placeholder="e.g. 9"
          />
        </SectionCard>

        {/*<hr className="border-neutral-100/80" />*/}

        {/* Interval Filter */}
        <SectionCard title="Interval Filter">
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <InputField
                id="filter-power"
                label="Power (W)"
                type="number"
                min="0"
                value={filterPowerStr}
                onChange={(e) => setFilterPowerStr(e.target.value)}
                placeholder="e.g. 300"
              />
              <InputField
                id="filter-time"
                label="Min. Time (m)"
                type="number"
                min="0"
                value={filterTimeStr}
                onChange={(e) => setFilterTimeStr(e.target.value)}
                placeholder="e.g. 5"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsFiltered(true)}
                className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-neutral-900/10 active:scale-[0.98]"
              >
                Apply Filter
              </button>
              {isFiltered && (
                <button
                  onClick={() => setIsFiltered(false)}
                  className="flex-[0.5] bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border border-neutral-200 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98]"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </SectionCard>

        <hr className="border-neutral-100/80" />

        {/* About / CTA */}
        <div className="mt-auto pt-4 bg-gradient-to-b from-blue-50/50 to-blue-50/20 border border-blue-100/60 p-6 flex flex-col gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
            <Compass className="w-24 h-24 text-blue-600" />
          </div>
          <div className="relative z-10">
            <h3 className="font-black text-blue-900 text-lg mb-2">Contribute a Route</h3>
            <p className="text-sm text-blue-800/70 leading-relaxed font-medium mb-5">
              Help the cycling community by crowdsourcing safe, traffic-free segments.
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
      </aside>

      {/* Main Map Viewport */}
      <section className="flex-1 h-[60vh] md:h-full bg-neutral-100/50 relative">
        {error && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[5000] bg-red-50/90 backdrop-blur-md border border-red-200 text-red-700 px-6 py-4 shadow-xl max-w-sm w-[90%] text-center animate-in slide-in-from-top-4 fade-in duration-300">
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

        <div className="w-full h-full overflow-hidden bg-white">
          <Map segments={filteredSegments} riderPower={powerStr} riderWeight={weightStr} bikeWeight={bikeWeightStr} isFiltered={isFiltered} filterPower={filterPowerStr} filterTime={filterTimeStr} onSegmentBlocked={handleSegmentBlocked} />
        </div>

        {/* Floating Modal Overlay for Form */}
        {showSubmissionContent && (
          <div className="absolute inset-0 z-[9999] bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <SubmissionForm onClose={() => setShowSubmissionContent(false)} />
          </div>
        )}
      </section>
    </main >
  );
}
