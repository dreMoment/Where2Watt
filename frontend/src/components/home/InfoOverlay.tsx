import Image from "next/image";
import { Info } from "lucide-react";

interface InfoOverlayProps {
  isOpen: boolean;
  isMobileViewport: boolean;
  hideInfoScreenNextTime: boolean;
  onHideInfoScreenNextTimeChange: (checked: boolean) => void;
  onContinue: () => void;
}

export default function InfoOverlay({
  isOpen,
  isMobileViewport,
  hideInfoScreenNextTime,
  onHideInfoScreenNextTimeChange,
  onContinue,
}: InfoOverlayProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-[9998] flex items-center justify-center bg-neutral-900/50 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-info-title"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl sm:p-6 md:p-8"
      >
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 max-w-[38rem]">
            <h2 id="landing-info-title" className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              Welcome to Where2Watt
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:mt-3 md:text-base">
              This tool helps you find and share safe road segments for your outdoor training.
            </p>
          </div>
          <Image
            src="/logo.svg"
            alt="Where2Watt logo"
            width={56}
            height={56}
            className="h-10 w-10 shrink-0 sm:h-12 sm:w-12 md:h-14 md:w-14"
          />
        </div>

        <div className="mt-5 space-y-2.5 text-sm leading-relaxed text-neutral-600 sm:mt-6 sm:space-y-3 md:text-base">
          <p>
            Adjust your rider profile values to personalize estimated segment completion times. You can find these by toggling the sidebar on the left.
          </p>
          <p>Apply power and duration filters to find segments that best match your target duration.</p>
          <p>Sign in with Strava if you want to contribute new segments or rate routes you have ridden.</p>
          <p>Have fun and stay safe :)</p>
        </div>

        <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
          {isMobileViewport && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-amber-400 bg-amber-50 px-3.5 py-3 text-amber-900">
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="center-text text-center text-sm font-medium leading-relaxed md:text-base">
                The app experience works best on a device with a wider screen, such as a laptop or PC.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 sm:py-2.5"
          >
            Continue
          </button>
          <label className="flex cursor-pointer select-none items-center gap-3 text-sm leading-tight text-neutral-700">
            <input
              type="checkbox"
              checked={hideInfoScreenNextTime}
              onChange={(event) => onHideInfoScreenNextTimeChange(event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
            />
            Do not show this info screen again
          </label>
        </div>
      </div>
    </div>
  );
}
