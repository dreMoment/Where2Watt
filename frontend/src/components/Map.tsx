"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, { Popup, Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import SegmentCard from "./SegmentCard";
import CommunityRatingsPanel from "./CommunityRatingsPanel";
import SegmentElevationProfile, { type ElevationProfilePoint } from "./SegmentElevationProfile";
import { decodePolyline } from "@/utils/polyline";
import type { ExploreCandidate, Segment, SegmentAverageRatings } from "@/types";
import {
  createIntervalProfile,
  estimateSegmentDurationSeconds,
  formatDuration,
  getIntervalMarginRatio,
  parseIntervalMinutes,
} from "@/utils/intervals";

interface MapProps {
  segments: Segment[];
  riderPower?: string;
  riderWeight?: string;
  bikeWeight?: string;
  isFiltered?: boolean;
  filterPower?: string;
  filterTime?: string;
  onSegmentBlocked?: (segmentId: string, report: { blocked: boolean }) => void;
  onSegmentRated?: (segmentId: string, rating: { ratings_count: number; average_ratings: SegmentAverageRatings }) => void;
  focusSegmentId?: string;
  focusSegmentNonce?: number;
  autoSelectFocusedSegment?: boolean;
  persistViewport?: boolean;
  communityRatingsInitiallyFolded?: boolean;
  showCommunityRatings?: boolean;
  elevationProfileAsPopup?: boolean;
  segmentDetailsAsTopLeftOverlay?: boolean;
  showSegmentReportAction?: boolean;
  exploreCandidates?: ExploreCandidate[];
  /** Whether the home sidebar currently covers the left of the map (desktop). */
  sidebarOpen?: boolean;
  /** Bumped when the user applies a filter; frames the matching segments. */
  fitMatchesNonce?: number;
  /** Reports whether the docked segment details panel is open. */
  onSegmentPanelChange?: (open: boolean) => void;
}

const MAP_VIEWPORT_STORAGE_KEY = "where2watt:lastMapViewport";
const TERRAIN_SOURCE_ID = "terrain-source";
const TERRAIN_EXAGGERATION = 2;

type MapInstance = ReturnType<MapRef["getMap"]>;

type MapViewport = {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
};

function ElevationProfilePopup({
  segment,
  points,
  isLoading,
}: {
  segment: Segment;
  points: ElevationProfilePoint[] | null;
  isLoading: boolean;
}) {
  const [isFolded, setIsFolded] = useState(false);

  return (
    <div className="w-[min(92vw,380px)] rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
      <div className={`${isFolded ? "" : "mb-2"} flex items-start justify-between gap-2`}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-600">Elevation Profile</span>
          <span className="truncate text-sm font-semibold text-neutral-800">{segment.name}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsFolded((previous) => !previous)}
          aria-label={isFolded ? "Expand elevation profile" : "Fold elevation profile"}
          title={isFolded ? "Expand elevation profile" : "Fold elevation profile"}
          className="hidden shrink-0 rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 sm:inline-flex"
        >
          {isFolded ? "Show" : "Hide"}
        </button>
      </div>
      {!isFolded ? (
        <SegmentElevationProfile
          points={points}
          isLoading={isLoading}
          showHeader={false}
          elevationGainM={Math.max(0, (segment.distance_km ?? 0) * (segment.gradient_pct ?? 0) * 10)}
        />
      ) : null}
    </div>
  );
}

const DEFAULT_VIEWPORT: MapViewport = {
  longitude: 8.5417,
  latitude: 47.3769,
  zoom: 11,
  bearing: 0,
  pitch: 0,
};

function distanceKmBetween(a: [number, number], b: [number, number]): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function downsampleCoordinates(coordinates: [number, number][], maxPoints = 50): [number, number][] {
  if (coordinates.length <= maxPoints) return coordinates;
  return Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * (coordinates.length - 1));
    return coordinates[sourceIndex];
  });
}

function waitForTerrainToSettle(map: MapInstance, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let frameId: number | null = null;
    let finished = false;

    const terrainIsReady = () => {
      if (!map.getSource(TERRAIN_SOURCE_ID) || map.isMoving()) return false;

      try {
        return map.isSourceLoaded(TERRAIN_SOURCE_ID) === true;
      } catch {
        return false;
      }
    };

    const cleanup = () => {
      map.off("idle", checkReadiness);
      map.off("sourcedata", checkReadiness);
      signal.removeEventListener("abort", handleAbort);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };

    const finish = (ready: boolean) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(ready);
    };

    const checkReadiness = () => {
      if (signal.aborted) {
        finish(false);
        return;
      }
      if (!terrainIsReady() || frameId !== null) return;

      // Check again on the next frame. A focus request may start a camera
      // transition later in the same React effect cycle.
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (terrainIsReady()) {
          finish(true);
        }
      });
    };

    const handleAbort = () => finish(false);

    map.on("idle", checkReadiness);
    map.on("sourcedata", checkReadiness);
    signal.addEventListener("abort", handleAbort, { once: true });
    checkReadiness();
  });
}

function hasSavedViewport(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(MAP_VIEWPORT_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function getSegmentsBounds(segments: Segment[]): [[number, number], [number, number]] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const segment of segments) {
    if (!segment.polyline) continue;
    for (const [lng, lat] of decodePolyline(segment.polyline)) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function getInitialViewport(): MapViewport {
  if (typeof window === "undefined") {
    return DEFAULT_VIEWPORT;
  }

  try {
    const raw = localStorage.getItem(MAP_VIEWPORT_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_VIEWPORT;
    }
    const parsed = JSON.parse(raw) as Partial<MapViewport>;
    if (
      typeof parsed.longitude !== "number" ||
      typeof parsed.latitude !== "number" ||
      typeof parsed.zoom !== "number" ||
      typeof parsed.bearing !== "number" ||
      typeof parsed.pitch !== "number"
    ) {
      return DEFAULT_VIEWPORT;
    }
    return {
      longitude: parsed.longitude,
      latitude: parsed.latitude,
      zoom: parsed.zoom,
      bearing: parsed.bearing,
      pitch: parsed.pitch,
    };
  } catch {
    return DEFAULT_VIEWPORT;
  }
}

/**
 * Returns a color between orange (#f97316) and green (#16a34a)
 * based on how much margin a segment has above the target interval time.
 * ratio = segmentTime / targetTime (can be < 1.0 since filter allows 5% below).
 * ratio <= 1.05 → orange (tight, within ±5% of target)
 * ratio >= 1.25 → green  (plenty of margin)
 * In between  → interpolated via HSL hue
 */
function getMarginColor(ratio: number): string {
  const TIGHT = 1.05;
  const PLENTY = 1.25;
  const t = Math.min(1, Math.max(0, (ratio - TIGHT) / (PLENTY - TIGHT)));
  // Orange (hue 25) when only just long enough → green (hue 135) with plenty of room.
  const hue = 25 + t * (135 - 25);
  return `hsl(${hue}, 65%, 45%)`;
}

export default function InteractiveMap({
  segments,
  riderPower,
  riderWeight,
  bikeWeight,
  isFiltered,
  filterPower,
  filterTime,
  onSegmentBlocked,
  onSegmentRated,
  focusSegmentId,
  focusSegmentNonce,
  autoSelectFocusedSegment = false,
  persistViewport = true,
  communityRatingsInitiallyFolded = false,
  showCommunityRatings = true,
  elevationProfileAsPopup = false,
  segmentDetailsAsTopLeftOverlay = false,
  showSegmentReportAction = true,
  exploreCandidates = [],
  sidebarOpen = false,
  fitMatchesNonce = 0,
  onSegmentPanelChange,
}: MapProps) {
  const initialFocusedSegment =
    autoSelectFocusedSegment && focusSegmentId
      ? segments.find((segment) => segment.id === focusSegmentId) ?? null
      : null;
  const initialFocusedCoordinate =
    initialFocusedSegment?.polyline ? decodePolyline(initialFocusedSegment.polyline)[0] ?? null : null;

  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(initialFocusedSegment);
  const [selectedCandidate, setSelectedCandidate] = useState<ExploreCandidate | null>(null);
  const [clickedCoordinate, setClickedCoordinate] = useState<[number, number] | null>(initialFocusedCoordinate);
  const [hoveredSegment, setHoveredSegment] = useState<Segment | null>(null);
  const [hoveredCoordinate, setHoveredCoordinate] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState("grab");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [elevationProfile, setElevationProfile] = useState<ElevationProfilePoint[] | null>(null);
  const [isElevationProfileLoading, setIsElevationProfileLoading] = useState(false);
  const [initialViewport] = useState<MapViewport>(() => getInitialViewport());
  const mapRef = useRef<MapRef | null>(null);
  const lastFocusRequestRef = useRef<string | null>(null);
  const shouldFitSegmentsRef = useRef<boolean>(persistViewport && !hasSavedViewport());

  const filteredSegments = segments;

  // Pre-compute interval margin colors for each segment when filter is active
  const filterProfile = useMemo(
    () => createIntervalProfile(filterPower, riderWeight, bikeWeight),
    [filterPower, riderWeight, bikeWeight]
  );
  const targetMinutes = parseIntervalMinutes(filterTime);

  const hoverProfile = useMemo(
    () => createIntervalProfile(riderPower ?? "250", riderWeight ?? "75", bikeWeight ?? "9"),
    [riderPower, riderWeight, bikeWeight]
  );

  const hoverEstimatedTimeSeconds = useMemo(() => {
    if (!hoveredSegment || !hoverProfile) return null;
    return estimateSegmentDurationSeconds(hoveredSegment, hoverProfile);
  }, [hoveredSegment, hoverProfile]);

  const segmentColors = useMemo(() => {
    if (!isFiltered || !filterProfile || !targetMinutes) return {};
    const colors: Record<string, string> = {};
    filteredSegments.forEach((seg, idx) => {
      const key = seg.id || String(idx);
      const ratio = getIntervalMarginRatio(seg, filterProfile, targetMinutes);
      if (!ratio) return;
      colors[key] = getMarginColor(ratio);
    });
    return colors;
  }, [filteredSegments, isFiltered, filterProfile, targetMinutes]);

  // We use Carto Light (Voyager) as a free vector tile source that looks similar to the previous leaflet map
  const mapStyle = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

  const interactiveLayerIds = useMemo(() => [
    ...filteredSegments.map((s, idx) => `route-hit-${s.id || idx}`),
    ...exploreCandidates.map((candidate) => `candidate-hit-${candidate.id}`),
  ], [filteredSegments, exploreCandidates]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
    const handleViewportChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobileViewport(event.matches);
    };

    handleViewportChange(mobileMediaQuery);
    if (typeof mobileMediaQuery.addEventListener === "function") {
      mobileMediaQuery.addEventListener("change", handleViewportChange);
    } else if (typeof mobileMediaQuery.addListener === "function") {
      mobileMediaQuery.addListener(handleViewportChange);
    }

    return () => {
      if (typeof mobileMediaQuery.removeEventListener === "function") {
        mobileMediaQuery.removeEventListener("change", handleViewportChange);
      } else if (typeof mobileMediaQuery.removeListener === "function") {
        mobileMediaQuery.removeListener(handleViewportChange);
      }
    };
  }, []);

  // On a first visit (no saved viewport), frame all segments once they are loaded.
  useEffect(() => {
    if (!shouldFitSegmentsRef.current || !isMapLoaded || !mapRef.current || focusSegmentId) return;
    const bounds = getSegmentsBounds(filteredSegments);
    if (!bounds) return;
    shouldFitSegmentsRef.current = false;
    const padding = isMobileViewport
      ? { top: 80, bottom: 48, left: 56, right: 56 }
      : { top: 96, bottom: 64, left: 440, right: 96 }; // leave room for the sidebar, open by default on desktop
    mapRef.current.fitBounds(bounds, { padding, maxZoom: 12, duration: 0 });
  }, [filteredSegments, isMapLoaded, isMobileViewport, focusSegmentId]);

  // Frame the selected route in the part of the map the details panel leaves visible.
  const fitSegmentIntoVisibleArea = (segment: Segment) => {
    const bounds = getSegmentsBounds([segment]);
    const map = mapRef.current;
    if (!bounds || !map) return;
    const container = map.getContainer();
    const padding = isMobileViewport
      ? { top: isFiltered ? 128 : 88, bottom: Math.round(container.clientHeight * 0.62) + 24, left: 32, right: 32 }
      : { top: 96, bottom: 64, left: sidebarOpen ? 380 + 48 : 96, right: 420 };
    map.fitBounds(bounds, { padding, maxZoom: 14, duration: 600 });
  };

  // After "Apply Filter", frame the matching segments in the area the sidebar leaves visible.
  const lastFitMatchesNonceRef = useRef(fitMatchesNonce);
  useEffect(() => {
    if (fitMatchesNonce === lastFitMatchesNonceRef.current || !isMapLoaded || !mapRef.current) return;
    lastFitMatchesNonceRef.current = fitMatchesNonce;
    const bounds = getSegmentsBounds(filteredSegments);
    if (!bounds) return;
    const panelOpen = Boolean(selectedSegment) && !segmentDetailsAsTopLeftOverlay;
    const mapHeight = mapRef.current.getContainer().clientHeight;
    const padding = isMobileViewport
      ? { top: 128, bottom: panelOpen ? Math.round(mapHeight * 0.62) + 24 : 48, left: 56, right: 56 }
      : { top: 128, bottom: 64, left: sidebarOpen ? 380 + 64 : 96, right: panelOpen ? 420 : 96 };
    mapRef.current.fitBounds(bounds, { padding, maxZoom: 13, duration: 600 });
    // Only re-run when the user applies a filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitMatchesNonce, isMapLoaded]);

  // Re-frame the selected route when the desktop sidebar opens or closes over it.
  const previousSidebarOpenRef = useRef(sidebarOpen);
  useEffect(() => {
    if (previousSidebarOpenRef.current === sidebarOpen) return;
    previousSidebarOpenRef.current = sidebarOpen;
    if (selectedSegment && !isMobileViewport && !segmentDetailsAsTopLeftOverlay) {
      fitSegmentIntoVisibleArea(selectedSegment);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarOpen]);

  const closeSelectedSegment = () => {
    setSelectedSegment(null);
    setClickedCoordinate(null);
  };

  const handleSelectedSegmentBlocked = (segmentId: string, report: { blocked: boolean }) => {
    onSegmentBlocked?.(segmentId, report);
    setSelectedSegment((previous) => {
      if (!previous || previous.id !== segmentId) return previous;
      return { ...previous, blocked: report.blocked };
    });
  };

  const handleSelectedSegmentRated = (
    segmentId: string,
    rating: { ratings_count: number; average_ratings: SegmentAverageRatings }
  ) => {
    onSegmentRated?.(segmentId, rating);
    setSelectedSegment((previous) => {
      if (!previous || previous.id !== segmentId) return previous;
      return { ...previous, ratings_count: rating.ratings_count, average_ratings: rating.average_ratings };
    });
  };

  // Home: segment details live in a docked panel (bottom sheet on mobile, right-hand panel on desktop).
  const showSegmentPanel = Boolean(selectedSegment) && !segmentDetailsAsTopLeftOverlay;

  useEffect(() => {
    onSegmentPanelChange?.(showSegmentPanel);
  }, [showSegmentPanel, onSegmentPanelChange]);

  // Close the details when a filter hides the selected segment.
  useEffect(() => {
    if (!selectedSegment) return;
    if (filteredSegments.some((segment) => segment.id === selectedSegment.id)) return;
    closeSelectedSegment();
  }, [filteredSegments, selectedSegment]);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadElevationProfile() {
      if (!selectedSegment?.polyline || !isMapLoaded || !mapRef.current) {
        setElevationProfile(null);
        setIsElevationProfileLoading(false);
        return;
      }

      const map = mapRef.current.getMap();
      if (typeof map.queryTerrainElevation !== "function") {
        setElevationProfile(null);
        setIsElevationProfileLoading(false);
        return;
      }

      const coordinates = downsampleCoordinates(decodePolyline(selectedSegment.polyline));
      if (coordinates.length < 2) {
        setElevationProfile(null);
        setIsElevationProfileLoading(false);
        return;
      }

      setIsElevationProfileLoading(true);
      const terrainReady = await waitForTerrainToSettle(map, abortController.signal);
      if (!terrainReady) return;

      let cumulativeDistanceKm = 0;
      const profile: ElevationProfilePoint[] = [];

      for (let index = 0; index < coordinates.length; index += 1) {
        const coordinate = coordinates[index];
        if (index > 0) {
          cumulativeDistanceKm += distanceKmBetween(coordinates[index - 1], coordinate);
        }
        const exaggeratedElevation = map.queryTerrainElevation(coordinate);
        if (typeof exaggeratedElevation !== "number" || !Number.isFinite(exaggeratedElevation)) {
          setElevationProfile(null);
          setIsElevationProfileLoading(false);
          return;
        }
        profile.push({
          distanceKm: cumulativeDistanceKm,
          elevationM: exaggeratedElevation / TERRAIN_EXAGGERATION,
        });
      }

      if (!abortController.signal.aborted) {
        setElevationProfile(profile.length >= 2 ? profile : null);
        setIsElevationProfileLoading(false);
      }
    }

    loadElevationProfile();

    return () => {
      abortController.abort();
    };
  }, [selectedSegment?.id, selectedSegment?.polyline, isMapLoaded]);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    if (!focusSegmentId) return;

    const focusRequestKey = `${focusSegmentId}:${focusSegmentNonce ?? 0}`;
    if (focusRequestKey === lastFocusRequestRef.current) return;

    const focusSegment = filteredSegments.find((segment) => segment.id === focusSegmentId);
    if (!focusSegment?.polyline) return;

    const coordinates = decodePolyline(focusSegment.polyline);
    if (coordinates.length === 0) return;

    const [firstLng, firstLat] = coordinates[0];
    let minLng = firstLng;
    let maxLng = firstLng;
    let minLat = firstLat;
    let maxLat = firstLat;

    for (const [lng, lat] of coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    if (minLng === maxLng && minLat === maxLat) {
      mapRef.current.flyTo({ center: [minLng, minLat], zoom: 8, duration: 1200, essential: true });
    } else {
      mapRef.current.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 260, maxZoom: 15, duration: 1200, essential: true }
      );
    }

    lastFocusRequestRef.current = focusRequestKey;
  }, [focusSegmentId, focusSegmentNonce, filteredSegments, isMapLoaded]);

  return (
    <div className="h-full w-full shadow-lg overflow-hidden relative">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: initialViewport.longitude,
          latitude: initialViewport.latitude,
          zoom: initialViewport.zoom,
          bearing: initialViewport.bearing,
          pitch: initialViewport.pitch,
        }}
        maxPitch={85}
        terrain={{ source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION }}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        onLoad={() => setIsMapLoaded(true)}
        interactiveLayerIds={interactiveLayerIds}
        onClick={(e) => {
          if (e.features && e.features.length > 0) {
            const featureId = e.features[0].properties?.id;
            const candidate = exploreCandidates.find((item) => item.id === featureId);
            if (candidate) {
              setSelectedCandidate(candidate);
              setSelectedSegment(null);
              return;
            }
            const clickedSegment = filteredSegments.find(s => s.id === featureId);
            if (clickedSegment) {
              setSelectedCandidate(null);
              setSelectedSegment(clickedSegment);
              if (e.lngLat) {
                setClickedCoordinate([e.lngLat.lng, e.lngLat.lat]);
              }
              if (!segmentDetailsAsTopLeftOverlay) {
                fitSegmentIntoVisibleArea(clickedSegment);
              }
              return;
            }
          }
          setSelectedSegment(null);
          setSelectedCandidate(null);
          setClickedCoordinate(null);
        }}
        onMouseEnter={() => setCursor("pointer")}
        onMouseMove={(e) => {
          if (e.features && e.features.length > 0) {
            const featureId = e.features[0].properties?.id;
            const matchedSegment = filteredSegments.find((segment) => String(segment.id) === String(featureId));

            if (matchedSegment && e.lngLat) {
              setHoveredSegment(matchedSegment);
              setHoveredCoordinate([e.lngLat.lng, e.lngLat.lat]);
              return;
            }
          }

          setHoveredSegment(null);
          setHoveredCoordinate(null);
        }}
        onMouseLeave={() => {
          setCursor("grab");
          setHoveredSegment(null);
          setHoveredCoordinate(null);
        }}
        onMoveEnd={(event) => {
          if (!persistViewport) return;
          const { longitude, latitude, zoom, bearing, pitch } = event.viewState;
          localStorage.setItem(
            MAP_VIEWPORT_STORAGE_KEY,
            JSON.stringify({ longitude, latitude, zoom, bearing, pitch })
          );
        }}
        cursor={cursor}
      >
        <Source
          id={TERRAIN_SOURCE_ID}
          type="raster-dem"
          tiles={["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"]}
          encoding="terrarium"
          tileSize={256}
          maxzoom={14}
        />

        {/* The mobile segment sheet covers the controls, so drop them while it is open. */}
        {!(isMobileViewport && showSegmentPanel) && <NavigationControl position="bottom-right" visualizePitch={true} />}

        {exploreCandidates.map((candidate) => {
          const data = { type: "Feature" as const, properties: { id: candidate.id }, geometry: { type: "LineString" as const, coordinates: candidate.coordinates } };
          const selected = selectedCandidate?.id === candidate.id;
          return (
            <Source key={candidate.id} id={`candidate-${candidate.id}`} type="geojson" data={data}>
              <Layer id={`candidate-hit-${candidate.id}`} type="line" layout={{ "line-join": "round", "line-cap": "round" }} paint={{ "line-color": "#000", "line-opacity": 0.01, "line-width": 18 }} />
              <Layer id={`candidate-line-${candidate.id}`} type="line" layout={{ "line-join": "round", "line-cap": "round" }} paint={{ "line-color": selected ? "#047857" : "#10b981", "line-width": selected ? 6 : 4, "line-opacity": 0.85, "line-dasharray": [2, 1] }} />
            </Source>
          );
        })}

        {filteredSegments.map((segment, idx) => {
          if (!segment.polyline) return null;

          const coordinates = decodePolyline(segment.polyline);
          const geojsonData = {
            type: "Feature" as const,
            properties: { id: segment.id },
            geometry: {
              type: "LineString" as const,
              coordinates
            }
          };

          const isSelected = selectedSegment?.id === segment.id;
          const segKey = segment.id || String(idx);
          const isBlocked = segment.blocked === true;
          const defaultColor = (isFiltered && segmentColors[segKey]) ? segmentColors[segKey] : "#D81B60";
          const lineColor = isSelected ? "#880E4F" : defaultColor;
          const lineWidth = isSelected ? 6 : 3.5;
          const lineOpacity = isBlocked ? 0.3 : 0.8;

          const startCoord = coordinates.length > 0 ? coordinates[0] : null;

          return (
            <React.Fragment key={`segment-group-${segment.id || idx}`}>
              <Source id={`source-${segment.id || idx}`} type="geojson" data={geojsonData}>
                <Layer
                  id={`route-hit-${segment.id || idx}`}
                  type="line"
                  layout={{
                    "line-join": "round",
                    "line-cap": "round"
                  }}
                  paint={{
                    "line-color": "#000000",
                    // Slightly above zero keeps the layer pickable while remaining visually invisible.
                    "line-opacity": 0.01,
                    "line-width": isSelected ? 20 : 16
                  }}
                />
                <Layer
                  id={`route-casing-${segment.id || idx}`}
                  type="line"
                  layout={{
                    "line-join": "round",
                    "line-cap": "round"
                  }}
                  paint={{
                    "line-color": "#ffffff",
                    "line-width": ["interpolate", ["linear"], ["zoom"], 9, lineWidth + 5, 13, lineWidth + 3],
                    "line-opacity": lineOpacity
                  }}
                />
                <Layer
                  id={`route-${segment.id || idx}`}
                  type="line"
                  layout={{
                    "line-join": "round",
                    "line-cap": "round"
                  }}
                  paint={{
                    "line-color": lineColor,
                    "line-width": ["interpolate", ["linear"], ["zoom"], 9, lineWidth + 2, 13, lineWidth],
                    "line-opacity": lineOpacity
                  }}
                />
              </Source>
              {startCoord && (
                <Source id={`start-source-${segment.id || idx}`} type="geojson" data={{
                  type: "Feature",
                  geometry: { type: "Point", coordinates: startCoord },
                  properties: {}
                }}>
                  <Layer
                    id={`start-layer-${segment.id || idx}`}
                    type="circle"
                    paint={{
                      "circle-radius": isSelected ? 6 : 4.5,
                      "circle-stroke-color": "#ffffff",
                      "circle-color": isBlocked ? "rgba(22, 163, 74, 0.3)" : "rgba(22, 163, 74, 1.0)", // transparent green if blocked
                      "circle-stroke-width": 2,
                    }}
                  />
                </Source>
              )}
            </React.Fragment>
          );
        })}

        {hoveredSegment && hoveredCoordinate && selectedSegment?.id !== hoveredSegment.id && (
          <Popup
            longitude={hoveredCoordinate[0]}
            latitude={hoveredCoordinate[1]}
            anchor="bottom"
            offset={[0, -8]}
            closeButton={false}
            closeOnClick={false}
            className="hover-segment-popup z-20"
            maxWidth="220px"
          >
            <div className="rounded-lg border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-xs text-neutral-800 shadow-sm backdrop-blur-sm">
              <div className="mb-0.5 max-w-[200px] truncate text-sm font-semibold text-neutral-900">{hoveredSegment.name}</div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-600">Est. time</span>
                <span className="font-semibold text-neutral-800">{formatDuration(hoverEstimatedTimeSeconds)}</span>
              </div>
              {isFiltered && targetMinutes && typeof hoverEstimatedTimeSeconds === "number" && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-600">vs. target</span>
                  <span className="font-semibold text-neutral-800">
                    {hoverEstimatedTimeSeconds >= targetMinutes * 60 ? "+" : "−"}
                    {formatDuration(Math.abs(hoverEstimatedTimeSeconds - targetMinutes * 60))}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-600">Avg rating</span>
                <span className="font-semibold text-neutral-800">
                  {typeof hoveredSegment.average_ratings?.overall_quality === "number"
                    ? `${(Math.round((hoveredSegment.average_ratings.overall_quality / 2) * 10) / 10).toFixed(1)} / 5`
                    : "No ratings"}
                </span>
              </div>
              
            </div>
          </Popup>
        )}

        {selectedCandidate && (
          <Popup longitude={selectedCandidate.coordinates[0][0]} latitude={selectedCandidate.coordinates[0][1]} anchor="bottom" closeOnClick={false} onClose={() => setSelectedCandidate(null)} maxWidth="310px">
            <div className="p-1 text-sm text-neutral-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Potential Strava segment · Category {selectedCandidate.climb_category_description ?? selectedCandidate.climb_category}</div>
              <h3 className="mt-1 text-base font-black">{selectedCandidate.name}</h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded bg-neutral-100 px-2 py-1">{selectedCandidate.distance_km} km</span><span className="rounded bg-neutral-100 px-2 py-1">{Math.round(selectedCandidate.elevation_difference_m)} m elevation</span><span className="rounded bg-neutral-100 px-2 py-1">{selectedCandidate.average_grade_pct}% avg</span></div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">Automatically discovered and not yet community-approved. Check the segment before riding.</p>
              <a href={selectedCandidate.strava_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-bold text-emerald-700 hover:underline">View on Strava ↗</a>
            </div>
          </Popup>
        )}

      </Map>
      {selectedSegment && segmentDetailsAsTopLeftOverlay && (
        <div className="pointer-events-auto absolute left-4 top-4 z-20 max-h-[calc(100%-2rem)] w-[min(92vw,350px)] overflow-y-auto rounded-xl border border-neutral-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm">
          <SegmentCard
            segment={selectedSegment}
            riderPower={riderPower}
            riderWeight={riderWeight}
            bikeWeight={bikeWeight}
            clickedCoordinate={clickedCoordinate}
            elevationProfile={elevationProfile}
            isElevationProfileLoading={isElevationProfileLoading}
            showElevationProfile={!elevationProfileAsPopup}
            showReportAction={showSegmentReportAction}
            onSegmentBlocked={handleSelectedSegmentBlocked}
            onClose={closeSelectedSegment}
          />
        </div>
      )}
      {showSegmentPanel && selectedSegment && (
        <section
          aria-label={`Segment details: ${selectedSegment.name}`}
          className={`pointer-events-auto absolute z-40 overflow-y-auto overscroll-contain bg-white ${
            isMobileViewport
              ? "inset-x-0 bottom-0 max-h-[62dvh] rounded-t-2xl border-t border-neutral-200 px-4 pt-4 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.25rem))] shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.25)]"
              : "right-3 top-[4.25rem] max-h-[calc(100%-13.75rem)] w-[380px] rounded-2xl border border-neutral-200 p-5 shadow-xl"
          }${selectedSegment.blocked ? " ring-2 ring-red-600" : ""}`}
        >
          <SegmentCard
            segment={selectedSegment}
            riderPower={riderPower}
            riderWeight={riderWeight}
            bikeWeight={bikeWeight}
            clickedCoordinate={clickedCoordinate}
            elevationProfile={elevationProfile}
            isElevationProfileLoading={isElevationProfileLoading}
            showElevationProfile={!elevationProfileAsPopup}
            showReportAction={showSegmentReportAction}
            onSegmentBlocked={handleSelectedSegmentBlocked}
            onClose={closeSelectedSegment}
            stickyHeader
          />
          {showCommunityRatings && (
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <CommunityRatingsPanel
                segment={selectedSegment}
                embedded
                onSegmentRated={handleSelectedSegmentRated}
              />
            </div>
          )}
          <div
            className={`pointer-events-none sticky bottom-0 h-8 bg-gradient-to-t from-white to-transparent ${
              isMobileViewport ? "-mx-4 -mb-8" : "-mx-5 -mb-5"
            }`}
            aria-hidden="true"
          />
        </section>
      )}
      {selectedSegment && elevationProfileAsPopup && (
        <div className="pointer-events-auto absolute bottom-4 right-4 z-20 sm:right-20">
          <ElevationProfilePopup
            key={selectedSegment.id || selectedSegment.strava_id || selectedSegment.name}
            segment={selectedSegment}
            points={elevationProfile}
            isLoading={isElevationProfileLoading}
          />
        </div>
      )}
      {showCommunityRatings && selectedSegment && !showSegmentPanel && (
        <div className="pointer-events-auto absolute bottom-9 right-3 z-20">
          <CommunityRatingsPanel
            segment={selectedSegment}
            initiallyFolded={communityRatingsInitiallyFolded}
            onSegmentRated={handleSelectedSegmentRated}
          />
        </div>
      )}
    </div>
  );
}
