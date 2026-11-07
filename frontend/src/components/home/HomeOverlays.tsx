import SubmissionForm from "@/components/SubmissionForm";
import InfoOverlay from "@/components/home/InfoOverlay";
import Dialog from "@/components/ui/Dialog";

interface HomeOverlaysProps {
  showSubmissionContent: boolean;
  showInfoScreen: boolean;
  hideInfoScreenNextTime: boolean;
  onCloseSubmission: () => void;
  onExistingSegmentRated: (segmentId?: string) => Promise<void>;
  onHideInfoScreenNextTimeChange: (checked: boolean) => void;
  onContinueInfo: () => void;
}

export default function HomeOverlays({
  showSubmissionContent,
  showInfoScreen,
  hideInfoScreenNextTime,
  onCloseSubmission,
  onExistingSegmentRated,
  onHideInfoScreenNextTimeChange,
  onContinueInfo,
}: HomeOverlaysProps) {
  return (
    <>
      {showSubmissionContent && (
        <Dialog labelledBy="submission-dialog-title" onClose={onCloseSubmission} backdropClassName="bg-neutral-900/40 backdrop-blur-sm">
          <SubmissionForm onClose={onCloseSubmission} onExistingSegmentRated={onExistingSegmentRated} />
        </Dialog>
      )}

      <InfoOverlay
        isOpen={showInfoScreen}
        hideInfoScreenNextTime={hideInfoScreenNextTime}
        onHideInfoScreenNextTimeChange={onHideInfoScreenNextTimeChange}
        onContinue={onContinueInfo}
      />
    </>
  );
}
