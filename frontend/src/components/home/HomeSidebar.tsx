import type { RefObject } from "react";
import Link from "next/link";
import { ChevronDown, Compass, Trash2, User, Plus } from "lucide-react";
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
      className={`absolute inset-y-0 left-0 z-20 w-full transform border-r border-neutral-100 bg-white shadow-[4px_0_20px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-in-out md:w-[380px] ${
        sidebarOpen ? "pointer-events-auto translate-x-0" : "pointer-events-none -translate-x-full"
      }`}
    >
      <div className="flex h-full w-full flex-col overflow-y-auto pt-16 md:w-[380px]">
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
          <InputField
            id="global-weight"
            label="Rider (kg)"
            type="number"
            min="0"
            value={filter.preferencesReady ? filter.weightStr : ""}
            onChange={(event) => actions.onWeightChange(event.target.value)}
            placeholder={filter.preferencesReady ? "e.g. 75" : ""}
          />
          <InputField
            id="global-bike-weight"
            label="Bike (kg)"
            type="number"
            min="0"
            value={filter.preferencesReady ? filter.bikeWeightStr : ""}
            onChange={(event) => actions.onBikeWeightChange(event.target.value)}
            placeholder={filter.preferencesReady ? "e.g. 9" : ""}
          />
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
                label="Min. Time (m)"
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
                className="flex-1 rounded-xl bg-neutral-900 py-2.5 text-xs font-bold text-white shadow-md shadow-neutral-900/10 transition-all hover:bg-neutral-800 active:scale-[0.98]"
              >
                Apply Filter
              </button>
              {filter.isFiltered && (
                <button
                  type="button"
                  onClick={actions.onResetFilter}
                  className="flex-[0.5] rounded-xl border border-neutral-200 bg-neutral-100 py-2.5 text-xs font-bold text-neutral-600 transition-all hover:bg-neutral-200 active:scale-[0.98]"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </SectionCard>

        {!auth.loading && !auth.isLoggedIn && (
          <div className="mb-4 mt-6 flex flex-col items-center gap-2 px-4 text-center">
            <StravaConnectButton onClick={actions.onLogin} />
            <p className="text-xs text-neutral-500">Connect with Strava to contribute or rate a segment.</p>
          </div>
        )}

        <hr className="border-neutral-100/80" />

        <div className="group relative mt-auto flex flex-col gap-4 overflow-hidden border border-blue-100/60 bg-gradient-to-b from-blue-50/50 to-blue-50/20 p-6 pt-4">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 transform p-4 opacity-10 transition-transform duration-500 group-hover:scale-110">
            <Compass className="h-24 w-24 text-blue-600" />
          </div>
          <div className="relative z-10">
            <h3 className="mb-2 text-lg font-black text-blue-900">Contribute a Route</h3>
            <p className="mb-5 text-sm font-medium leading-relaxed text-blue-800/70">
              Help the cycling community by crowdsourcing safe, traffic-free segments.
            </p>
            <button
              type="button"
              onClick={actions.onSubmitSegment}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl active:translate-y-0"
            >
              <Plus className="h-5 w-5" />
              Submit Segment
            </button>
          </div>
        </div>

        <div className="bg-white/70 px-5 py-3">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
            <Link href="/privacy-policy" className="font-medium text-neutral-500 hover:text-neutral-800">
              Privacy
            </Link>
            <span className="text-neutral-300" aria-hidden="true">
              •
            </span>
            <Link href="/terms" className="font-medium text-neutral-500 hover:text-neutral-800">
              Terms
            </Link>
            <span className="text-neutral-300" aria-hidden="true">
              •
            </span>
            <Link href="/support" className="font-medium text-neutral-500 hover:text-neutral-800">
              Support
            </Link>
            <span>Where2Watt uses the Strava API and is not endorsed by Strava</span>
            <span className="hidden text-neutral-300 sm:inline" aria-hidden="true">
              {" "}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
