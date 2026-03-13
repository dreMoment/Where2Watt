import SubmissionForm from "@/components/SubmissionForm";
import InfoOverlay from "@/components/home/InfoOverlay";

interface HomeOverlaysProps {
  showSubmissionContent: boolean;
  showInfoScreen: boolean;
  isMobileViewport: boolean;
  hideInfoScreenNextTime: boolean;
  onCloseSubmission: () => void;
  onExistingSegmentRated: () => Promise<void>;
  onHideInfoScreenNextTimeChange: (checked: boolean) => void;
  onContinueInfo: () => void;
}

export default function HomeOverlays({
  showSubmissionContent,
  showInfoScreen,
  isMobileViewport,
  hideInfoScreenNextTime,
  onCloseSubmission,
  onExistingSegmentRated,
  onHideInfoScreenNextTimeChange,
  onContinueInfo,
}: HomeOverlaysProps) {
  return (
    <>
      {showSubmissionContent && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <SubmissionForm onClose={onCloseSubmission} onExistingSegmentRated={onExistingSegmentRated} />
        </div>
      )}

      <InfoOverlay
        isOpen={showInfoScreen}
        isMobileViewport={isMobileViewport}
        hideInfoScreenNextTime={hideInfoScreenNextTime}
        onHideInfoScreenNextTimeChange={onHideInfoScreenNextTimeChange}
        onContinue={onContinueInfo}
      />
    </>
  );
}
