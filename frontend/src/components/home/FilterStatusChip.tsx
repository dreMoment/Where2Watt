import { X } from "lucide-react";

interface FilterStatusChipProps {
  matchingCount: number;
  totalCount: number;
  power: string;
  minutes: string;
  onReset: () => void;
}

/** Floating summary of the active interval filter, so it stays visible with the sidebar closed. */
export default function FilterStatusChip({ matchingCount, totalCount, power, minutes, onReset }: FilterStatusChipProps) {
  const none = matchingCount === 0;

  return (
    <div
      role="status"
      className={`flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border py-0.5 pl-4 pr-0.5 text-sm shadow-md backdrop-blur-sm ${
        none ? "border-amber-300 bg-amber-50/95 text-amber-950" : "border-neutral-200 bg-white/95 text-neutral-800"
      }`}
    >
      <span className="truncate">
        {none ? (
          <>No segments match {power} W · {minutes} min</>
        ) : (
          <>
            <span className="font-semibold">{matchingCount} of {totalCount}</span> {matchingCount === 1 ? "matches" : "match"}{" "}
            {power} W · {minutes} min
          </>
        )}
      </span>
      <button
        type="button"
        onClick={onReset}
        aria-label="Clear interval filter"
        title="Clear filter"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
