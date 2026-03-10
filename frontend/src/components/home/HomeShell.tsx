import type { ReactNode } from "react";
import Image from "next/image";
import { PanelLeft, X } from "lucide-react";
import StravaCompatibleBadge from "@/components/StravaCompatibleBadge";

interface HomeShellProps {
  sidebarOpen: boolean;
  isMobileViewport: boolean;
  onToggleSidebar: () => void;
  onOpenInfoScreen: () => void;
  children: ReactNode;
}

export default function HomeShell({
  sidebarOpen,
  isMobileViewport,
  onToggleSidebar,
  onOpenInfoScreen,
  children,
}: HomeShellProps) {
  return (
    <main className="relative flex h-[100dvh] w-full overflow-hidden bg-[#f9fafb]">
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg border border-neutral-200/70 bg-white/90 p-2 text-neutral-500 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-neutral-800"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
        </button>
        <StravaCompatibleBadge className="-ml-2 w-[240px] sm:-ml-3 sm:w-[280px]" />
      </div>

      <button
        type="button"
        onClick={onOpenInfoScreen}
        className={`absolute top-3 right-3 z-30 p-0 transition-opacity hover:opacity-90 ${
          isMobileViewport && sidebarOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        title="Show onboarding info"
        aria-label="Show onboarding info"
      >
        <Image
          src="/logo.svg"
          alt="Where2Watt logo"
          width={64}
          height={64}
          priority
          className="h-[64px] w-[64px]"
        />
      </button>

      <div className="relative h-full w-full overflow-hidden">{children}</div>
    </main>
  );
}
