"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Plus, Compass, LogIn, LogOut, PanelLeft, X, Info } from "lucide-react";
import type { Segment, SegmentAverageRatings } from "@/types";
import { useAuth } from "@/components/AuthContext";
import SubmissionForm from "@/components/SubmissionForm";
import InputField from "@/components/InputField";
import SectionCard from "@/components/SectionCard";
import { fetchSegments } from "@/utils/api";
import { filterSegmentsByInterval } from "@/utils/intervals";

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

const HIDE_INFO_SCREEN_STORAGE_KEY = "hideLandingInfoScreen";

export default function Home() {
  const { user, isLoggedIn, login, logout, isLoading: authLoading } = useAuth();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [showSubmissionContent, setShowSubmissionContent] = useState(false);
  const [showInfoScreen, setShowInfoScreen] = useState(false);
  const [hideInfoScreenNextTime, setHideInfoScreenNextTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weightStr, setWeightStr] = useState("75");
  const [bikeWeightStr, setBikeWeightStr] = useState("9");

  // Filter state
  const [filterPowerStr, setFilterPowerStr] = useState("250");
  const [filterTimeStr, setFilterTimeStr] = useState("5"); // in minutes
  const [isFiltered, setIsFiltered] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
    const syncViewportState = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };
    syncViewportState(mobileMediaQuery);

    if (typeof mobileMediaQuery.addEventListener === "function") {
      mobileMediaQuery.addEventListener("change", syncViewportState);
    } else if (typeof mobileMediaQuery.addListener === "function") {
      mobileMediaQuery.addListener(syncViewportState);
    }

    const p = localStorage.getItem("plannedPower");
    const w = localStorage.getItem("riderWeight");
    const bw = localStorage.getItem("bikeWeight");
    const hideInfoScreen = localStorage.getItem(HIDE_INFO_SCREEN_STORAGE_KEY) === "true";
    if (p) {
      setFilterPowerStr(p);
    }
    if (w) setWeightStr(w);
    if (bw) setBikeWeightStr(bw);
    setHideInfoScreenNextTime(hideInfoScreen);
    const shouldShowInfoScreen = !hideInfoScreen;
    setShowInfoScreen(shouldShowInfoScreen);
    setSidebarOpen(!mobileMediaQuery.matches && !shouldShowInfoScreen);

    return () => {
      if (typeof mobileMediaQuery.removeEventListener === "function") {
        mobileMediaQuery.removeEventListener("change", syncViewportState);
      } else if (typeof mobileMediaQuery.removeListener === "function") {
        mobileMediaQuery.removeListener(syncViewportState);
      }
    };
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
    return filterSegmentsByInterval(segments, {
      isFiltered,
      filterPower: filterPowerStr,
      filterTimeMinutes: filterTimeStr,
      riderWeight: weightStr,
      bikeWeight: bikeWeightStr,
    });
  }, [segments, isFiltered, filterPowerStr, filterTimeStr, weightStr, bikeWeightStr]);

  const handleSegmentBlocked = useCallback((segmentId: string, report: { blocked: boolean }) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === segmentId
          ? {
            ...s,
            blocked: report.blocked,
          }
          : s
      )
    );
  }, []);

  const handleSegmentRated = useCallback(
    (segmentId: string, rating: { ratings_count: number; average_ratings: SegmentAverageRatings }) => {
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId
            ? {
              ...s,
              ratings_count: rating.ratings_count,
              average_ratings: rating.average_ratings,
            }
            : s
        )
      );
    },
    []
  );

  const closeInfoScreen = () => {
    localStorage.setItem(HIDE_INFO_SCREEN_STORAGE_KEY, hideInfoScreenNextTime ? "true" : "false");
    setShowInfoScreen(false);
    if (!isMobileViewport) {
      setSidebarOpen(true);
    }
  };

  const openInfoScreen = () => {
    setShowInfoScreen(true);
    setSidebarOpen(false);
  };

  return (
    <main className="relative flex h-[100dvh] w-full bg-[#f9fafb] overflow-hidden">
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="absolute top-3 left-3 z-30 p-2 rounded-lg border border-neutral-200/70 bg-white/90 text-neutral-500 backdrop-blur-sm hover:text-neutral-800 hover:bg-white transition-colors shadow-sm"
        title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
      </button>

      <button
        type="button"
        onClick={openInfoScreen}
        className="absolute top-3 right-3 z-30 p-0 transition-opacity hover:opacity-90"
        title="Show onboarding info"
        aria-label="Show onboarding info"
      >
        <Image
          src="/logo.svg"
          alt="Where2Watt logo"
          width={64}
          height={64}
          priority
          className="h-[64px] w-[64px]"
        />
      </button>

      {/* Body: layered sidebar + map */}
      <div className="h-full w-full overflow-hidden relative">
        {/* Main Map Viewport (kept full-size to avoid resize lag when toggling sidebar) */}
        <section className="absolute inset-0 bg-neutral-100/50">
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[5000] bg-red-50/90 backdrop-blur-md border border-red-200 text-red-700 px-6 py-4 shadow-xl max-w-sm w-[90%] text-center animate-in slide-in-from-top-4 fade-in duration-300">
              <p className="font-bold text-sm flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                {error}
              </p>
            </div>
          )}

          {!error && !loading && segments.length === 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[5000] bg-amber-50/90 backdrop-blur-md border border-amber-200 text-amber-800 px-6 py-4 rounded-2xl shadow-xl max-w-sm w-[90%] text-center animate-in slide-in-from-top-4 fade-in duration-300">
              <p className="font-bold text-sm">No intervals currently in the database. Be the first to add one!</p>
            </div>
          )}

          <div className="w-full h-full overflow-hidden bg-white">
            <Map
              segments={filteredSegments}
              riderPower={filterPowerStr}
              riderWeight={weightStr}
              bikeWeight={bikeWeightStr}
              isFiltered={isFiltered}
              filterPower={filterPowerStr}
              filterTime={filterTimeStr}
              onSegmentBlocked={handleSegmentBlocked}
              onSegmentRated={handleSegmentRated}
            />
          </div>

          {/* Floating Modal Overlay for Form */}
          {showSubmissionContent && (
            <div className="absolute inset-0 z-[9999] bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <SubmissionForm onClose={() => setShowSubmissionContent(false)} />
            </div>
          )}

          {showInfoScreen && (
            <div className="absolute inset-0 z-[9998] bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="landing-info-title"
                className="w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-neutral-200/90 bg-white shadow-2xl p-4 sm:p-6 md:p-8 max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-y-auto"
              >
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0 max-w-[38rem]">
                    <h2 id="landing-info-title" className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                      Welcome to Where2Watt
                    </h2>
                    <p className="mt-2 sm:mt-3 text-sm md:text-base text-neutral-600 leading-relaxed">
                      This tool helps you find and share safe road segments for your outdoor training.
                    </p>
                  </div>
                  <Image
                    src="/logo.svg"
                    alt="Where2Watt logo"
                    width={56}
                    height={56}
                    className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 shrink-0"
                  />
                </div>

                <div className="mt-5 sm:mt-6 space-y-2.5 sm:space-y-3 text-sm md:text-base text-neutral-600 leading-relaxed">
                  <p>
                    Adjust your rider profile values to personalize estimated segment completion times. You can find these by toggling the sidebar on the left.
                  </p>
                  <p>
                    Apply power and duration filters to find segments that best match your target duration.
                  </p>
                  <p>
                    Sign in with Strava if you want to contribute new segments or rate routes you have ridden.
                  </p>
                    <p>
                    Have fun and stay safe :)
                    </p>
                </div>

                <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
                  {isMobileViewport && (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-amber-400 bg-amber-50 px-3.5 py-3 text-amber-900">
                      <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <p className="center-text text-center text-sm md:text-base font-medium leading-relaxed">
                        The app experience works best on a device with a wider screen, such as a laptop or PC.
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={closeInfoScreen}
                    className="w-full rounded-xl bg-neutral-900 hover:bg-neutral-800 px-5 py-3 sm:py-2.5 text-sm font-semibold text-white transition-colors"
                  >
                    Continue
                  </button>
                  <label className="flex items-center gap-3 text-sm text-neutral-700 cursor-pointer select-none leading-tight">
                    <input
                      type="checkbox"
                      checked={hideInfoScreenNextTime}
                      onChange={(e) => setHideInfoScreenNextTime(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                    />
                    Do not show this info screen again
                  </label>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside
          className={`absolute inset-y-0 left-0 z-20 w-[350px] transform transition-transform duration-300 ease-in-out bg-white shadow-[4px_0_20px_rgba(0,0,0,0.04)] border-r border-neutral-100 ${
            sidebarOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
          }`}
        >
          <div className="w-[350px] h-full flex flex-col overflow-y-auto pt-16">
            {/* Rider Profile Configuration */}
            <SectionCard
              title="Rider Profile"
              headerContent={
                !authLoading ? (
                  isLoggedIn && user ? (
                    <div className="flex items-center gap-2.5">
                      {user.profile_pic && (
                        <img
                          src={user.profile_pic}
                          alt={user.firstname || "User"}
                          className="w-8 h-8 rounded-full border-2 border-neutral-200 shadow-sm"
                        />
                      )}
                      <span className="text-sm font-medium text-neutral-600">
                        {user.firstname}
                      </span>
                      <button
                        onClick={logout}
                        title="Log out"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={login}
                      className="flex items-center gap-1.5 bg-[#fc4c02] hover:bg-[#e34402] text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition-all shadow-sm hover:shadow-md"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      Strava Login
                    </button>
                  )
                ) : null
              }
            >
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

            {/* Contribute CTA */}
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
          </div>
        </aside>
      </div>
    </main>
  );
}
