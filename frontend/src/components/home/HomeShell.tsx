import type { ReactNode } from "react";
import Image from "next/image";
import { PanelLeft, X } from "lucide-react";
import StravaCompatibleBadge from "@/components/StravaCompatibleBadge";

interface HomeShellProps {
  sidebarOpen: boolean;
  isMobileViewport: boolean;
  onToggleSidebar: () => void;
  filterActive?: boolean;
  onOpenInfoScreen: () => void;
  children: ReactNode;
}

export default function HomeShell({
  sidebarOpen,
  isMobileViewport,
  onToggleSidebar,
  filterActive = false,
  onOpenInfoScreen,
  children,
}: HomeShellProps) {
  return (
    <main className="relative flex h-[100dvh] w-full overflow-hidden bg-[#f9fafb]">
      <h1 className="sr-only">Where2Watt: find road segments for interval training</h1>
      <div className="absolute top-3 left-3 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white/95 text-neutral-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-neutral-900"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          aria-expanded={sidebarOpen}
          aria-controls="home-sidebar"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
          {filterActive && !sidebarOpen && (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#d03d00] ring-2 ring-white" aria-hidden="true" />
          )}
        </button>
        <StravaCompatibleBadge
          className="h-11 rounded-xl border border-neutral-200 bg-white/95 px-3 shadow-sm backdrop-blur-sm"
          imageClassName="w-[150px] sm:w-[180px]"
        />
      </div>

      <button
        type="button"
        onClick={onOpenInfoScreen}
        className={`absolute top-3 right-3 z-50 flex h-11 w-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white/95 text-sm sm:w-auto sm:pl-1.5 sm:pr-3 font-bold tracking-tight text-neutral-900 shadow-sm backdrop-blur-sm transition-opacity hover:bg-white ${
          isMobileViewport && sidebarOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        inert={isMobileViewport && sidebarOpen}
        title="About Where2Watt"
        aria-label="About Where2Watt"
      >
        <Image src="/logo.svg" alt="" width={32} height={32} priority className="h-8 w-8" />
        <span className="hidden sm:inline">Where2Watt</span>
      </button>

      <div className="relative h-full w-full overflow-hidden">{children}</div>
    </main>
  );
}
