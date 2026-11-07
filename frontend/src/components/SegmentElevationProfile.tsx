import React, { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";

export type ElevationProfilePoint = {
  distanceKm: number;
  elevationM: number;
};

interface Props {
  points: ElevationProfilePoint[] | null;
  isLoading?: boolean;
  showHeader?: boolean;
  /** Prefer authoritative segment metadata for displayed gain; DEM samples are only used for chart shape. */
  elevationGainM?: number | null;
}

type ChartSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  fillColor: string;
  gradientPct: number;
};

function formatElevation(value: number): string {
  return `${Math.round(value)} m`;
}

function getGradientColor(gradientPct: number): string {
  if (gradientPct >= 10) return "#7f1d1d"; // deep wine red
  if (gradientPct >= 7) return "#b91c1c"; // muted red
  if (gradientPct >= 4) return "#ea580c"; // burnt orange
  if (gradientPct >= 1) return "#d97706"; // amber climb
  return "#15803d"; // calm green
}

function getGradientFillColor(gradientPct: number): string {
  if (gradientPct >= 10) return "rgba(127, 29, 29, 0.20)";
  if (gradientPct >= 7) return "rgba(185, 28, 28, 0.18)";
  if (gradientPct >= 4) return "rgba(234, 88, 12, 0.16)";
  if (gradientPct >= 1) return "rgba(217, 119, 6, 0.13)";
  return "rgba(21, 128, 61, 0.13)";
}

// Smooth the chart over a 600 m rolling window. This only affects the visual
// profile and gradient colors; displayed gain still uses the original data.
const ELEVATION_SMOOTHING_WINDOW_KM = 0.6;
const SMALL_DOWNHILL_THRESHOLD_M = 10;

function smoothElevationPoints(points: ElevationProfilePoint[], windowKm = ELEVATION_SMOOTHING_WINDOW_KM): ElevationProfilePoint[] {
  const halfWindowKm = windowKm / 2;

  return points.map((point) => {
    let weightedElevationSum = 0;
    let weightSum = 0;

    for (const candidate of points) {
      const distanceKm = Math.abs(candidate.distanceKm - point.distanceKm);
      if (distanceKm > halfWindowKm) continue;

      const weight = 1 - distanceKm / halfWindowKm;
      weightedElevationSum += candidate.elevationM * weight;
      weightSum += weight;
    }

    return {
      ...point,
      elevationM: weightSum > 0 ? weightedElevationSum / weightSum : point.elevationM,
    };
  });
}

function removeSmallDownhills(points: ElevationProfilePoint[], thresholdM = SMALL_DOWNHILL_THRESHOLD_M): ElevationProfilePoint[] {
  if (points.length < 2) return points;

  const cleanedPoints = [points[0]];

  for (let index = 1; index < points.length; index += 1) {
    const previous = cleanedPoints[index - 1];
    const current = points[index];
    const dropM = previous.elevationM - current.elevationM;

    cleanedPoints.push({
      ...current,
      elevationM: dropM > 0 && dropM <= thresholdM ? previous.elevationM : current.elevationM,
    });
  }

  return cleanedPoints;
}

function buildChart(points: ElevationProfilePoint[], width: number, height: number) {
  const chartPoints = removeSmallDownhills(smoothElevationPoints(points));
  const minElevation = Math.min(...chartPoints.map((point) => point.elevationM));
  const maxElevation = Math.max(...chartPoints.map((point) => point.elevationM));
  const totalDistance = chartPoints[chartPoints.length - 1].distanceKm;

  const paddingX = width > 500 ? 64 : 40;
  const paddingTop = width > 500 ? 28 : 12;
  const paddingBottom = width > 500 ? 48 : 22;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const baselineY = height - paddingBottom;
  const elevationRange = Math.max(1, maxElevation - minElevation);
  const distanceRange = Math.max(0.001, totalDistance);

  const xyPoints = chartPoints.map((point) => ({
    ...point,
    x: paddingX + (point.distanceKm / distanceRange) * chartWidth,
    y: paddingTop + (1 - (point.elevationM - minElevation) / elevationRange) * chartHeight,
  }));

  const segments: ChartSegment[] = [];
  for (let index = 1; index < xyPoints.length; index += 1) {
    const previous = xyPoints[index - 1];
    const current = xyPoints[index];
    const distanceMeters = Math.max(1, (current.distanceKm - previous.distanceKm) * 1000);
    const gradientPct = ((current.elevationM - previous.elevationM) / distanceMeters) * 100;
    segments.push({
      x1: previous.x,
      y1: previous.y,
      x2: current.x,
      y2: current.y,
      gradientPct,
      color: getGradientColor(gradientPct),
      fillColor: getGradientFillColor(gradientPct),
    });
  }

  return {
    minElevation,
    maxElevation,
    totalDistance,
    paddingX,
    paddingTop,
    baselineY,
    segments,
  };
}

function formatDistanceKm(value: number): string {
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} km`;
}

function ElevationSvg({ points, large = false }: { points: ElevationProfilePoint[]; large?: boolean }) {
  const width = large ? 1100 : 320;
  const height = large ? 460 : 120;
  const labelSize = large ? 18 : 10;
  const chart = useMemo(() => buildChart(points, width, height), [points, width, height]);
  const areaPoints = [
    `${chart.paddingX},${chart.baselineY}`,
    ...chart.segments.map((segment) => `${segment.x1},${segment.y1}`),
    chart.segments.length > 0 ? `${chart.segments[chart.segments.length - 1].x2},${chart.segments[chart.segments.length - 1].y2}` : "",
    `${width - chart.paddingX},${chart.baselineY}`,
  ].filter(Boolean).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label={`Elevation profile: ${formatDistanceKm(chart.totalDistance)}, from ${formatElevation(chart.minElevation)} to ${formatElevation(chart.maxElevation)}`}
    >
      <defs>
        <linearGradient id={`soft-base-fill-${large ? "large" : "small"}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#b91c1c" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <line x1={chart.paddingX} y1={chart.baselineY} x2={width - chart.paddingX} y2={chart.baselineY} stroke="#e7e5e4" strokeWidth="1" />
      <line x1={chart.paddingX} y1={chart.paddingTop} x2={chart.paddingX} y2={chart.baselineY} stroke="#e7e5e4" strokeWidth="1" />
      <polygon points={areaPoints} fill={`url(#soft-base-fill-${large ? "large" : "small"})`} />

      <g fill="#57534e" fontSize={labelSize} fontWeight={600}>
        <text x={chart.paddingX - 6} y={chart.paddingTop + labelSize * 0.35} textAnchor="end">
          {formatElevation(chart.maxElevation)}
        </text>
        <text x={chart.paddingX - 6} y={chart.baselineY} textAnchor="end">
          {formatElevation(chart.minElevation)}
        </text>
        <text x={chart.paddingX} y={chart.baselineY + labelSize + 6} textAnchor="start">
          0 km
        </text>
        <text x={width - chart.paddingX} y={chart.baselineY + labelSize + 6} textAnchor="end">
          {formatDistanceKm(chart.totalDistance)}
        </text>
      </g>

      {chart.segments.map((segment, index) => (
        <polygon
          key={`fill-${index}`}
          points={`${segment.x1.toFixed(1)},${chart.baselineY.toFixed(1)} ${segment.x1.toFixed(1)},${segment.y1.toFixed(1)} ${segment.x2.toFixed(1)},${segment.y2.toFixed(1)} ${segment.x2.toFixed(1)},${chart.baselineY.toFixed(1)}`}
          fill={segment.fillColor}
        />
      ))}

      {chart.segments.map((segment, index) => (
        <line
          key={`line-${index}`}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={segment.color}
          strokeWidth={large ? 5 : 3}
          strokeLinecap="round"
        />
      ))}

    </svg>
  );
}

export default function SegmentElevationProfile({ points, isLoading = false, showHeader = true, elevationGainM = null }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const validPoints = points?.filter((point) => Number.isFinite(point.distanceKm) && Number.isFinite(point.elevationM)) ?? [];

  if (isLoading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3">
        <div className={`flex items-center justify-between ${showHeader ? "mb-2" : "mb-1"}`}>
          {showHeader ? <span className="text-xs font-bold uppercase tracking-wide text-stone-600">Elevation profile</span> : null}
          <span className="text-[11px] text-stone-400">Loading…</span>
        </div>
        <div className="h-28 animate-pulse rounded-lg bg-stone-200/70" />
      </div>
    );
  }

  if (validPoints.length < 2) {
    return null;
  }

  const sampledGain = Math.max(0, validPoints[validPoints.length - 1].elevationM - validPoints[0].elevationM);
  const elevationGain = typeof elevationGainM === "number" && Number.isFinite(elevationGainM) && elevationGainM > 0
    ? elevationGainM
    : sampledGain;

  const expandedModal = isExpanded ? (
    <Dialog
      labelledBy="elevation-dialog-title"
      onClose={() => setIsExpanded(false)}
      backdropClassName="bg-stone-950/55 backdrop-blur-sm"
      className="flex max-h-[90dvh] w-[min(96vw,72rem)] flex-col overflow-y-auto rounded-2xl bg-[#fffdfa] p-4 shadow-2xl ring-1 ring-black/5 sm:rounded-3xl sm:p-6"
    >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="elevation-dialog-title" className="text-xl font-bold text-stone-800">Elevation profile</h2>
          <button type="button" onClick={() => setIsExpanded(false)} className="rounded-full bg-stone-100 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-200">
            Close
          </button>
        </div>
        <div className="rounded-2xl border border-stone-100 bg-white px-2 py-3 sm:px-4">
          <ElevationSvg points={validPoints} large />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-stone-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-700" /> ≤ 1%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> 1–4%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-600" /> 4–7%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-700" /> 7–10%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-900" /> ≥ 10%</span>
          <span className="ml-auto">Gain: {formatElevation(elevationGain)}</span>
        </div>
    </Dialog>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="w-full rounded-xl border border-stone-200 bg-[#fffdfa] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition hover:border-orange-200 hover:bg-orange-50/20"
        aria-label="Open larger elevation profile"
      >
        <div className={`flex items-center justify-between gap-3 ${showHeader ? "mb-2" : "mb-1"}`}>
          {showHeader ? <span className="text-xs font-bold uppercase tracking-wide text-stone-600">Elevation profile</span> : null}
          <span className="text-xs font-semibold text-stone-600">↗ {formatElevation(elevationGain)} · Expand</span>
        </div>
        <ElevationSvg points={validPoints} />
      </button>
      {expandedModal}
    </>
  );
}
