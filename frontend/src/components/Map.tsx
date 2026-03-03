"use client";

import React, { useState, useMemo } from "react";
import Map, { Popup, Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import SegmentCard from "./SegmentCard";
import { decodePolyline } from "@/utils/polyline";
import type { Segment } from "@/types";

interface MapProps {
  segments: Segment[];
  activeFilter: "All" | "Hilly" | "Flat";
  riderPower?: string;
  riderWeight?: string;
}

export default function InteractiveMap({ segments, activeFilter, riderPower, riderWeight }: MapProps) {
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [cursor, setCursor] = useState("grab");

  const filteredSegments =
    activeFilter === "All"
      ? segments
      : segments.filter((s) => s.terrain === activeFilter);

  // We use Carto Light (Voyager) as a free vector tile source that looks similar to the previous leaflet map
  const mapStyle = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

  const interactiveLayerIds = useMemo(
    () => filteredSegments.map((s, idx) => `route-${s.id || idx}`),
    [filteredSegments]
  );

  return (
    <div className="h-full w-full rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden relative">
      <Map
        initialViewState={{
          longitude: 8.5417,
          latitude: 47.3769,
          zoom: 11,
          bearing: 0
        }}
        maxPitch={85}
        terrain={{ source: "terrain-source", exaggeration: 1.5 }}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={interactiveLayerIds}
        onClick={(e) => {
          if (e.features && e.features.length > 0) {
            const featureId = e.features[0].properties?.id;
            const clickedSegment = filteredSegments.find(s => s.id === featureId);
            if (clickedSegment) {
              setSelectedSegment(clickedSegment);
              return;
            }
          }
          setSelectedSegment(null);
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
          const geojsonData: any = {
            type: "Feature",
            properties: { id: segment.id },
            geometry: {
              type: "LineString",
              coordinates
            }
          };

          const isSelected = selectedSegment?.id === segment.id;
          const lineColor = isSelected ? "#fc4c02" : (segment.terrain === "Hilly" ? "#be123c" : "#047857");
          const lineWidth = isSelected ? 5 : 3;

          return (
            <Source key={`source-${segment.id || idx}`} id={`source-${segment.id || idx}`} type="geojson" data={geojsonData}>
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
                  "line-opacity": 0.8
                }}
              />
            </Source>
          );
        })}

        {selectedSegment && (() => {
          const coordinates = selectedSegment.polyline ? decodePolyline(selectedSegment.polyline) : [];
          const startPoint = coordinates.length > 0 ? coordinates[0] : [
            8.5417 + filteredSegments.indexOf(selectedSegment) * 0.01,
            47.3769 + filteredSegments.indexOf(selectedSegment) * 0.01
          ];

          return (
            <Popup
              longitude={startPoint[0]}
              latitude={startPoint[1]}
              anchor="bottom"
              offset={[0, -10]}
              onClose={() => setSelectedSegment(null)}
              closeOnClick={false}
              className="custom-popup z-10"
              maxWidth="350px"
            >
              <div className="p-1">
                <SegmentCard segment={selectedSegment} riderPower={riderPower} riderWeight={riderWeight} />
              </div>
            </Popup>
          );
        })()}
      </Map>
    </div>
  );
}
