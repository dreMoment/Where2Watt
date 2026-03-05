"use client";

import React, { useState, useMemo } from "react";
import Map, { Popup, Source, Layer, NavigationControl, Marker } from "react-map-gl/maplibre";
import SegmentCard from "./SegmentCard";
import { decodePolyline } from "@/utils/polyline";
import { calculateVelocity } from "@/utils/physics";
import type { Segment } from "@/types";

interface MapProps {
  segments: Segment[];
  riderPower?: string;
  riderWeight?: string;
  bikeWeight?: string;
  isFiltered?: boolean;
  filterPower?: string;
  filterTime?: string;
  onSegmentBlocked?: (segmentId: string, blockedUntil?: string) => void;
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

export default function InteractiveMap({ segments, riderPower, riderWeight, bikeWeight, isFiltered, filterPower, filterTime, onSegmentBlocked }: MapProps) {
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [clickedCoordinate, setClickedCoordinate] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState("grab");

  const filteredSegments = segments;

  // Pre-compute interval margin colors for each segment when filter is active
  const targetTimeSec = isFiltered && filterTime ? parseFloat(filterTime) * 60 : 0;
  const filterPwr = isFiltered && filterPower ? parseFloat(filterPower) : 0;
  const rw = parseFloat(riderWeight || "75") || 75;
  const bw = parseFloat(bikeWeight || "9") || 9;

  const segmentColors = useMemo(() => {
    if (!isFiltered || !filterPwr || !targetTimeSec) return {};
    const colors: Record<string, string> = {};
    filteredSegments.forEach((seg, idx) => {
      const key = seg.id || String(idx);
      if (!seg.distance_km) return;
      const gradientDecimal = (seg.gradient_pct ?? 0) / 100;
      const velocity = calculateVelocity(filterPwr, gradientDecimal, rw, bw);
      if (velocity <= 0) return;
      const timeSec = (seg.distance_km * 1000) / velocity;
      const ratio = timeSec / targetTimeSec;
      colors[key] = getMarginColor(ratio);
    });
    return colors;
  }, [filteredSegments, isFiltered, filterPwr, targetTimeSec, rw, bw]);

  // We use Carto Light (Voyager) as a free vector tile source that looks similar to the previous leaflet map
  const mapStyle = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

  const interactiveLayerIds = useMemo(
    () => filteredSegments.map((s, idx) => `route-${s.id || idx}`),
    [filteredSegments]
  );

  return (
    <div className="h-full w-full shadow-lg overflow-hidden relative">
      <Map
        initialViewState={{
          longitude: 8.5417,
          latitude: 47.3769,
          zoom: 11,
          bearing: 0
        }}
        maxPitch={85}
        terrain={{ source: "terrain-source", exaggeration: 2 }}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
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
        onMouseLeave={() => setCursor("grab")}
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
          const defaultColor = (isFiltered && segmentColors[segKey]) ? segmentColors[segKey] : "#2563eb";
          const lineColor = isSelected ? "#fc4c02" : defaultColor;
          const lineWidth = isSelected ? 6 : 3;
          const lineOpacity = isBlocked ? 0.3 : 0.8;

          const startCoord = coordinates.length > 0 ? coordinates[0] : null;
          const endCoord = coordinates.length > 0 ? coordinates[coordinates.length - 1] : null;

          return (
            <React.Fragment key={`segment-group-${segment.id || idx}`}>
              <Source id={`source-${segment.id || idx}`} type="geojson" data={geojsonData}>
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
                  onSegmentBlocked={onSegmentBlocked}
                />
              </div>
            </Popup>
          );
        })()}
      </Map>
    </div>
  );
}
