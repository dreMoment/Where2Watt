import Image from "next/image";
import Dialog from "@/components/ui/Dialog";
import DialogCloseButton, { DIALOG_PANEL_CLASS } from "@/components/ui/DialogCloseButton";

interface InfoOverlayProps {
  isOpen: boolean;
  hideInfoScreenNextTime: boolean;
  onHideInfoScreenNextTimeChange: (checked: boolean) => void;
  onContinue: () => void;
}

export default function InfoOverlay({
  isOpen,
  hideInfoScreenNextTime,
  onHideInfoScreenNextTimeChange,
  onContinue,
}: InfoOverlayProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      labelledBy="landing-info-title"
      onClose={onContinue}
      className={`${DIALOG_PANEL_CLASS} max-h-[calc(100dvh-1.5rem)] max-w-2xl overflow-y-auto p-5 sm:max-h-[90dvh] sm:p-6 md:p-8`}
    >
        <DialogCloseButton onClick={onContinue} />
        <div className="flex items-start gap-3 pr-12 sm:gap-4">
          <Image
            src="/logo.svg"
            alt=""
            width={56}
            height={56}
            className="h-10 w-10 shrink-0 sm:h-12 sm:w-12"
          />
          <div className="min-w-0 max-w-[38rem]">
            <h2 id="landing-info-title" className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              Welcome to Where2Watt
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:mt-3 md:text-base">
              This tool helps you find and share safe road segments for your outdoor training.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5 text-sm leading-relaxed text-neutral-600 sm:mt-6 sm:space-y-3 md:text-base">
          <p>Click a highlighted road on the map to see its distance, gradient, estimated time and ratings.</p>
          <p>
            Set your rider profile in the sidebar (the button at the top left) to personalise the estimated times, and use
            the interval filter to find segments that match your target power and duration.
          </p>
          <p>Connect with Strava to submit new segments or rate the ones you have ridden.</p>
          <p>Have fun and stay safe.</p>
        </div>

        <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
          <label className="flex cursor-pointer select-none items-center gap-3 text-sm leading-tight text-neutral-700">
            <input
              type="checkbox"
              checked={hideInfoScreenNextTime}
              onChange={(event) => onHideInfoScreenNextTimeChange(event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
            />
            Don&apos;t show this again
          </label>
          <button
            type="button"
            data-autofocus
            onClick={onContinue}
            className="w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Continue
          </button>
        </div>
    </Dialog>
  );
}
