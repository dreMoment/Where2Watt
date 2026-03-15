"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, { Popup, Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import SegmentCard from "./SegmentCard";
import CommunityRatingsPanel from "./CommunityRatingsPanel";
import { decodePolyline } from "@/utils/polyline";
import type { Segment, SegmentAverageRatings } from "@/types";
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
}

const MAP_VIEWPORT_STORAGE_KEY = "where2watt:lastMapViewport";

type MapViewport = {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
};

const DEFAULT_VIEWPORT: MapViewport = {
  longitude: 8.5417,
  latitude: 47.3769,
  zoom: 11,
  bearing: 0,
  pitch: 0,
};

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
  // Reddish-orange hue ≈ 10, Green hue ≈ 140 (HSL)
  const hue = 0 + t * (140 - 10);
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
}: MapProps) {
  const initialFocusedSegment =
    autoSelectFocusedSegment && focusSegmentId
      ? segments.find((segment) => segment.id === focusSegmentId) ?? null
      : null;
  const initialFocusedCoordinate =
    initialFocusedSegment?.polyline ? decodePolyline(initialFocusedSegment.polyline)[0] ?? null : null;

  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(initialFocusedSegment);
  const [clickedCoordinate, setClickedCoordinate] = useState<[number, number] | null>(initialFocusedCoordinate);
  const [hoveredSegment, setHoveredSegment] = useState<Segment | null>(null);
  const [hoveredCoordinate, setHoveredCoordinate] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState("grab");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isRatingsVisible, setIsRatingsVisible] = useState(true);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [initialViewport] = useState<MapViewport>(() => getInitialViewport());
  const mapRef = useRef<MapRef | null>(null);
  const lastFocusRequestRef = useRef<string | null>(null);

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

  const interactiveLayerIds = useMemo(
    () => filteredSegments.map((s, idx) => `route-hit-${s.id || idx}`),
    [filteredSegments]
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
    const handleViewportChange = (event: MediaQueryListEvent | MediaQueryList) => {
      const isMobile = event.matches;
      setIsMobileViewport(isMobile);
      if (!isMobile) {
        setIsRatingsVisible(true);
      }
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

  useEffect(() => {
    if (!selectedSegment) return;
    setIsRatingsVisible(!isMobileViewport);
  }, [selectedSegment, isMobileViewport]);

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
        terrain={{ source: "terrain-source", exaggeration: 2 }}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        onLoad={() => setIsMapLoaded(true)}
        interactiveLayerIds={interactiveLayerIds}
        onClick={(e) => {
          if (e.features && e.features.length > 0) {
            const featureId = e.features[0].properties?.id;
            const clickedSegment = filteredSegments.find(s => s.id === featureId);
            if (clickedSegment) {
              setSelectedSegment(clickedSegment);
              if (e.lngLat) {
                setClickedCoordinate([e.lngLat.lng, e.lngLat.lat]);
              }
              return;
            }
          }
          setSelectedSegment(null);
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
          id="terrain-source"
          type="raster-dem"
          tiles={["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"]}
          encoding="terrarium"
          tileSize={256}
          maxzoom={14}
        />

        <NavigationControl position="bottom-right" visualizePitch={true} />

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
          const lineColor = isSelected ? "#C2185B" : defaultColor;
          const lineWidth = isSelected ? 6 : 3;
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
                  id={`route-${segment.id || idx}`}
                  type="line"
                  layout={{
                    "line-join": "round",
                    "line-cap": "round"
                  }}
                  paint={{
                    "line-color": lineColor,
                    "line-width": lineWidth,
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
                      "circle-radius": 3.5,
                      "circle-color": isBlocked ? "rgba(22, 163, 74, 0.3)" : "rgba(22, 163, 74, 1.0)", // transparent green if blocked
                      "circle-stroke-width": 0,
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
            <div className="rounded-md border border-neutral-200 bg-white/95 px-1.5 py-1 text-xs text-neutral-800 shadow-sm backdrop-blur-sm">
              <div className="mt-0.5 flex items-center justify-between gap-3">
                <span className="text-neutral-500">Est. time</span>
                <span className="font-semibold text-neutral-800">{formatDuration(hoverEstimatedTimeSeconds)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-500">Avg rating</span>
                <span className="font-semibold text-neutral-800">
                  {typeof hoveredSegment.average_ratings?.overall_quality === "number"
                    ? `${(Math.round((hoveredSegment.average_ratings.overall_quality / 2) * 10) / 10).toFixed(1)} / 5`
                    : "No ratings"}
                </span>
              </div>
              
            </div>
          </Popup>
        )}

        {selectedSegment && (() => {
          const coordinates = selectedSegment.polyline ? decodePolyline(selectedSegment.polyline) : [];
          const startPoint = clickedCoordinate || (coordinates.length > 0 ? coordinates[0] : [
            8.5417 + filteredSegments.indexOf(selectedSegment) * 0.01,
            47.3769 + filteredSegments.indexOf(selectedSegment) * 0.01
          ]);

          return (
            <Popup
              longitude={startPoint[0]}
              latitude={startPoint[1]}
              anchor="bottom"
              offset={[0, -10]}
              onClose={() => {
                setSelectedSegment(null);
                setClickedCoordinate(null);
              }}
              closeOnClick={false}
              className={`custom-popup z-10${selectedSegment.blocked ? ' blocked-popup' : ''}`}
              maxWidth="350px"
            >
              <div className="p-1">
                <SegmentCard
                  segment={selectedSegment}
                  riderPower={riderPower}
                  riderWeight={riderWeight}
                  bikeWeight={bikeWeight}
                  clickedCoordinate={clickedCoordinate}
                  onSegmentBlocked={(segmentId, report) => {
                    onSegmentBlocked?.(segmentId, report);
                    setSelectedSegment((prev) => {
                      if (!prev || prev.id !== segmentId) return prev;
                      return { ...prev, blocked: report.blocked };
                    });
                  }}
                />
              </div>
            </Popup>
          );
        })()}
      </Map>
      {selectedSegment && isMobileViewport && (
        <button
          type="button"
          onClick={() => setIsRatingsVisible((prev) => !prev)}
          className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white/95 px-5 py-2.5 text-xs font-semibold text-neutral-700 shadow-md backdrop-blur-sm"
        >
          {isRatingsVisible ? "Hide ratings" : "Show ratings"}
        </button>
      )}
      {selectedSegment && (!isMobileViewport || isRatingsVisible) && (
        <div
          className={`pointer-events-auto absolute z-20 ${
            isMobileViewport ? "left-1/2 bottom-16 w-[min(92vw,340px)] -translate-x-1/2" : "right-20 bottom-4"
          }`}
        >
          <CommunityRatingsPanel
            segment={selectedSegment}
            onSegmentRated={(segmentId, rating) => {
              onSegmentRated?.(segmentId, rating);
              setSelectedSegment((prev) => {
                if (!prev || prev.id !== segmentId) return prev;
                return {
                  ...prev,
                  ratings_count: rating.ratings_count,
                  average_ratings: rating.average_ratings,
                };
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
