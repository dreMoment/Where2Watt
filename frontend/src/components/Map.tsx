"use client";

import React, { useState } from "react";
import Map, { Marker, Popup, Source, Layer } from "react-map-gl/maplibre";
import { MapPin } from "lucide-react";
import SegmentCard from "./SegmentCard";
import { decodePolyline } from "@/utils/polyline";
import type { Segment } from "@/types";

interface MapProps {
  segments: Segment[];
  activeFilter: "All" | "Hilly" | "Flat";
}

export default function InteractiveMap({ segments, activeFilter }: MapProps) {
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);

  const filteredSegments =
    activeFilter === "All"
      ? segments
      : segments.filter((s) => s.terrain === activeFilter);

  // We use Carto Light (Voyager) as a free vector tile source that looks similar to the previous leaflet map
  const mapStyle = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

  return (
    <div className="h-full w-full rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden relative">
      <Map
        initialViewState={{
          longitude: -0.3235,
          latitude: 51.2407,
          zoom: 11
        }}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        onClick={() => setSelectedSegment(null)}
      >
        {filteredSegments.map((segment, idx) => {
          let polylineSource = null;
          if (segment.polyline) {
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

            polylineSource = (
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
          }

          return (
            <React.Fragment key={`frag-${segment.id || idx}`}>
              {polylineSource}
              <Marker
                longitude={segment.longitude ?? -0.3235 + idx * 0.01}
                latitude={segment.latitude ?? 51.2407 + idx * 0.01}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedSegment(segment);
                }}
              >
                <div className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors drop-shadow-md">
                  <MapPin fill="currentColor" size={32} />
                </div>
              </Marker>
            </React.Fragment>
          );
        })}

        {selectedSegment && (
          <Popup
            longitude={selectedSegment.longitude ?? -0.3235 + filteredSegments.indexOf(selectedSegment) * 0.01}
            latitude={selectedSegment.latitude ?? 51.2407 + filteredSegments.indexOf(selectedSegment) * 0.01}
            anchor="bottom"
            offset={[0, -32]}
            onClose={() => setSelectedSegment(null)}
            closeOnClick={false}
            className="custom-popup z-10"
            maxWidth="350px"
          >
            <div className="p-1">
              <SegmentCard segment={selectedSegment} />
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
