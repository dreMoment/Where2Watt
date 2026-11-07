import type { RefObject } from "react";
import Link from "next/link";
import { ChevronDown, Trash2, User, Plus } from "lucide-react";
import InputField from "@/components/InputField";
import SectionCard from "@/components/SectionCard";
import StravaConnectButton from "@/components/StravaConnectButton";

interface HomeSidebarProps {
  auth: {
    loading: boolean;
    isLoggedIn: boolean;
    actorIdLabel: string;
    isDisconnecting: boolean;
    isProfileMenuOpen: boolean;
    userPresent: boolean;
  };
  filter: {
    isFiltered: boolean;
    matchingSegmentsCount: number;
    error: string | null;
    totalSegmentsCount: number;
    preferencesReady: boolean;
    weightStr: string;
    bikeWeightStr: string;
    filterPowerStr: string;
    filterTimeStr: string;
  };
  actions: {
    onLogin: () => void;
    onLogout: () => void;
    onDisconnect: () => void;
    onToggleProfileMenu: () => void;
    onSubmitSegment: () => void;
    onApplyFilter: () => void;
    onResetFilter: () => void;
    onWeightChange: (value: string) => void;
    onBikeWeightChange: (value: string) => void;
    onFilterPowerChange: (value: string) => void;
    onFilterTimeChange: (value: string) => void;
  };
  profileMenuRef: RefObject<HTMLDivElement | null>;
  sidebarOpen: boolean;
}

export default function HomeSidebar({
  auth,
  filter,
  actions,
  profileMenuRef,
  sidebarOpen,
}: HomeSidebarProps) {
  return (
    <aside
      id="home-sidebar"
      aria-label="Filters and account"
      inert={!sidebarOpen}
      className={`absolute inset-y-0 left-0 z-[45] max-h-[100dvh] w-full overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] transform border-r border-neutral-100 bg-white shadow-[4px_0_20px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-in-out md:w-[380px] ${
        sidebarOpen ? "pointer-events-auto translate-x-0" : "pointer-events-none -translate-x-full"
      }`}
    >
      <div className="flex min-h-full w-full flex-col pt-[4.25rem] md:w-[380px]">
        <SectionCard
          title="Rider Profile"
          headerContent={
            !auth.loading && auth.isLoggedIn && auth.userPresent ? (
              <div ref={profileMenuRef} className="relative z-30">
                <button
                  type="button"
                  onClick={actions.onToggleProfileMenu}
                  aria-haspopup="menu"
                  aria-expanded={auth.isProfileMenuOpen}
                  title="Open account menu"
                  className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-1.5 py-1 shadow-sm transition-colors hover:border-neutral-300"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white shadow-inner">
                    <User aria-hidden="true" className="h-4.5 w-4.5" />
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
                </button>

                {auth.isProfileMenuOpen && (
                  <div role="menu" className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl">
                    <div className="rounded-lg px-2.5 py-2 text-xs text-neutral-500">
                      <p className="break-all text-sm font-bold text-neutral-900">{auth.actorIdLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={actions.onLogout}
                      className="flex w-full items-center justify-center rounded-lg border border-neutral-200 px-2.5 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                    >
                      Logout
                    </button>
                    <button
                      type="button"
                      onClick={actions.onDisconnect}
                      disabled={auth.isDisconnecting}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      {auth.isDisconnecting ? "Disconnecting..." : "Disconnect Strava"}
                    </button>
                  </div>
                )}
              </div>
            ) : null
          }
        >
          <div className="flex gap-3">
          <InputField
            id="global-weight"
            label="Rider weight (kg)"
            type="number"
            min="0"
            value={filter.preferencesReady ? filter.weightStr : ""}
            onChange={(event) => actions.onWeightChange(event.target.value)}
            placeholder={filter.preferencesReady ? "e.g. 75" : ""}
          />
          <InputField
            id="global-bike-weight"
            label="Bike weight (kg)"
            type="number"
            min="0"
            value={filter.preferencesReady ? filter.bikeWeightStr : ""}
            onChange={(event) => actions.onBikeWeightChange(event.target.value)}
            placeholder={filter.preferencesReady ? "e.g. 9" : ""}
          />
          </div>
        </SectionCard>

        <SectionCard title="Interval Filter">
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <InputField
                id="filter-power"
                label="Power (W)"
                type="number"
                min="0"
                value={filter.preferencesReady ? filter.filterPowerStr : ""}
                onChange={(event) => actions.onFilterPowerChange(event.target.value)}
                placeholder={filter.preferencesReady ? "e.g. 300" : ""}
              />
              <InputField
                id="filter-time"
                label="Min. time (min)"
                type="number"
                min="0"
                value={filter.preferencesReady ? filter.filterTimeStr : ""}
                onChange={(event) => actions.onFilterTimeChange(event.target.value)}
                placeholder={filter.preferencesReady ? "e.g. 5" : ""}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={actions.onApplyFilter}
                className="flex-1 rounded-xl border border-transparent bg-neutral-900 py-3 text-sm font-bold text-white shadow-md shadow-neutral-900/10 transition-all hover:bg-neutral-800 active:scale-[0.98]"
              >
                Apply Filter
              </button>
              {filter.isFiltered && (
                <button
                  type="button"
                  onClick={actions.onResetFilter}
                  className="flex-[0.5] rounded-xl border border-neutral-300 bg-white py-3 text-sm font-bold text-neutral-900 transition-all hover:bg-neutral-50 active:scale-[0.98]"
                >
                  Reset
                </button>
              )}
            </div>
            {filter.error && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {filter.error}
              </p>
            )}
            {filter.isFiltered && !filter.error && (
              <div role="status" className="flex flex-col gap-2 text-sm text-neutral-700">
                <p>
                  <span className="font-semibold">{filter.matchingSegmentsCount}</span> of {filter.totalSegmentsCount} segments
                  match this interval.
                  {filter.matchingSegmentsCount === 0 && " Try a lower power or a shorter time."}
                </p>
                {filter.matchingSegmentsCount > 0 && (
                  <div className="flex flex-col gap-1">
                    <span
                      className="h-2 w-full rounded-full bg-[linear-gradient(90deg,hsl(25,65%,45%),hsl(80,65%,45%),hsl(135,65%,45%))]"
                      aria-hidden="true"
                    />
                    <div className="flex justify-between text-xs text-neutral-600">
                      <span>Only just long enough</span>
                      <span>Plenty of room</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3 border-b border-neutral-100 p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-600">Contribute</h2>
          <p className="text-sm leading-relaxed text-neutral-600">
            Know a quiet, uninterrupted road for intervals? Share it with the community.
          </p>
          {!auth.loading && !auth.isLoggedIn ? (
            <>
              <StravaConnectButton onClick={actions.onLogin} className="self-start" />
              <p className="text-xs text-neutral-600">Connect with Strava to submit or rate segments.</p>
            </>
          ) : (
            <button
              type="button"
              onClick={actions.onSubmitSegment}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white py-3 text-sm font-bold text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Submit a segment
            </button>
          )}
        </div>

        <div className="mt-auto px-5 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-neutral-600">
            <Link href="/privacy-policy" className="font-medium text-neutral-600 hover:text-neutral-900">
              Privacy
            </Link>
            <span className="text-neutral-300" aria-hidden="true">
              •
            </span>
            <Link href="/terms" className="font-medium text-neutral-600 hover:text-neutral-900">
              Terms
            </Link>
            <span className="text-neutral-300" aria-hidden="true">
              •
            </span>
            <Link href="/support" className="font-medium text-neutral-600 hover:text-neutral-900">
              Support
            </Link>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-neutral-600">
            Where2Watt uses the Strava API and is not endorsed by Strava.
          </p>
        </div>
      </div>
    </aside>
  );
}
