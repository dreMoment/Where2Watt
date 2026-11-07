import React, { useEffect, useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import DialogCloseButton, { DIALOG_PANEL_CLASS } from "@/components/ui/DialogCloseButton";

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
  /** Segment name shown in the expanded dialog title. */
  title?: string;
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
  if (gradientPct >= 1) return "#ca8a04"; // yellow climb
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

  const paddingX = width > 500 ? 64 : 48;
  const paddingRight = width > 500 ? 24 : 16;
  const paddingTop = width > 500 ? 28 : 12;
  const paddingBottom = width > 500 ? 48 : 22;
  const chartWidth = width - paddingX - paddingRight;
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
    paddingRight,
    paddingTop,
    baselineY,
    segments,
  };
}

function useIsNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

function formatDistanceKm(value: number): string {
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} km`;
}

function ElevationSvg({ points, large = false }: { points: ElevationProfilePoint[]; large?: boolean }) {
  // The expanded chart uses a phone-sized canvas on narrow screens so its labels stay readable.
  const narrow = useIsNarrowScreen() && large;
  const width = large && !narrow ? 1100 : 320;
  const height = large ? (narrow ? 220 : 460) : 120;
  const labelSize = large && !narrow ? 13 : 11;
  const chart = useMemo(() => buildChart(points, width, height), [points, width, height]);
  const areaPoints = [
    `${chart.paddingX},${chart.baselineY}`,
    ...chart.segments.map((segment) => `${segment.x1},${segment.y1}`),
    chart.segments.length > 0 ? `${chart.segments[chart.segments.length - 1].x2},${chart.segments[chart.segments.length - 1].y2}` : "",
    `${width - chart.paddingRight},${chart.baselineY}`,
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

      <line x1={chart.paddingX} y1={chart.baselineY} x2={width - chart.paddingRight} y2={chart.baselineY} stroke="#e7e5e4" strokeWidth="1" />
      <line x1={chart.paddingX} y1={chart.paddingTop} x2={chart.paddingX} y2={chart.baselineY} stroke="#e7e5e4" strokeWidth="1" />
      <polygon points={areaPoints} fill={`url(#soft-base-fill-${large ? "large" : "small"})`} />

      <g fill="#525252" fontSize={labelSize} fontWeight={600}>
        <text x={chart.paddingX - 6} y={chart.paddingTop + labelSize * 0.35} textAnchor="end">
          {formatElevation(chart.maxElevation)}
        </text>
        <text x={chart.paddingX - 6} y={chart.baselineY} textAnchor="end">
          {formatElevation(chart.minElevation)}
        </text>
        <text x={chart.paddingX} y={chart.baselineY + labelSize + 6} textAnchor="start">
          0 km
        </text>
        <text x={width - chart.paddingRight} y={chart.baselineY + labelSize + 6} textAnchor="end">
          {formatDistanceKm(chart.totalDistance)}
        </text>
      </g>


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

export default function SegmentElevationProfile({ points, isLoading = false, showHeader = true, elevationGainM = null, title }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const validPoints = points?.filter((point) => Number.isFinite(point.distanceKm) && Number.isFinite(point.elevationM)) ?? [];

  if (isLoading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3">
        <div className={`flex items-center justify-between ${showHeader ? "mb-2" : "mb-1"}`}>
          {showHeader ? <span className="text-xs font-bold uppercase tracking-widest text-neutral-600">Elevation profile</span> : null}
          <span className="text-xs text-neutral-600">Loading…</span>
        </div>
        <div className="h-28 animate-pulse rounded-lg bg-neutral-200/70" />
      </div>
    );
  }

  if (validPoints.length < 2) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 text-xs text-neutral-600">
        {showHeader ? (
          <>
            <span className="font-bold uppercase tracking-widest">Elevation profile</span>
            <span aria-hidden="true"> · </span>
          </>
        ) : null}
        Not available for this segment right now.
      </div>
    );
  }

  const sampledGain = Math.max(0, validPoints[validPoints.length - 1].elevationM - validPoints[0].elevationM);
  const elevationGain = typeof elevationGainM === "number" && Number.isFinite(elevationGainM) && elevationGainM > 0
    ? elevationGainM
    : sampledGain;

  const expandedModal = isExpanded ? (
    <Dialog
      labelledBy="elevation-dialog-title"
      onClose={() => setIsExpanded(false)}
      backdropClassName="bg-neutral-950/55 backdrop-blur-sm"
      className={`${DIALOG_PANEL_CLASS} flex max-h-[90dvh] max-w-6xl flex-col overflow-y-auto p-4 sm:p-6`}
    >
        <DialogCloseButton onClick={() => setIsExpanded(false)} />
        <h2 id="elevation-dialog-title" className="mb-4 pr-12 text-xl font-bold text-neutral-900">
          Elevation profile{title ? <span className="font-semibold text-neutral-600"> · {title}</span> : null}
        </h2>
        <div className="rounded-2xl border border-neutral-100 bg-white px-2 py-3 sm:px-4">
          <ElevationSvg points={validPoints} large />
        </div>
        <div className="mt-4 flex flex-col gap-2 text-xs font-semibold text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-700" /> &lt; 1%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-600" /> 1–4%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-600" /> 4–7%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-700" /> 7–10%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-900" /> ≥ 10%</span>
          </div>
          <span className="border-t border-neutral-100 pt-2 sm:border-0 sm:pt-0">Gain: {formatElevation(elevationGain)}</span>
        </div>
    </Dialog>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition hover:border-orange-200 hover:bg-orange-50/20"
        aria-label="Open larger elevation profile"
      >
        <div className={`flex items-center justify-between gap-3 ${showHeader ? "mb-2" : "mb-1"}`}>
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-600">
            {showHeader ? "Elevation profile " : ""}
            <span className="font-semibold normal-case tracking-normal text-neutral-700">↗ {formatElevation(elevationGain)}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700">
            <Maximize2 className="h-3 w-3" aria-hidden="true" /> Expand
          </span>
        </div>
        <ElevationSvg points={validPoints} />
      </button>
      {expandedModal}
    </>
  );
}
