import { LogIn } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import StravaConnectButton from "@/components/StravaConnectButton";
import Dialog from "@/components/ui/Dialog";
import DialogCloseButton, { DIALOG_PANEL_CLASS } from "@/components/ui/DialogCloseButton";

interface LoginRequiredDialogProps {
  /** What the user was trying to do, e.g. "rate segments". */
  action: string;
  onClose: () => void;
}

export default function LoginRequiredDialog({ action, onClose }: LoginRequiredDialogProps) {
  const { login } = useAuth();

  return (
    <Dialog labelledBy="login-required-title" onClose={onClose} className={`${DIALOG_PANEL_CLASS} max-w-md p-6 sm:p-8`}>
      <DialogCloseButton onClick={onClose} />
      <div className="flex flex-col items-center py-2 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-orange-100 bg-orange-50 text-[#d03d00]">
          <LogIn className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 id="login-required-title" className="mb-2 text-2xl font-bold tracking-tight text-neutral-900">
          Connect with Strava
        </h2>
        <p className="mb-6 text-sm text-neutral-600">You need to connect your Strava account to {action}.</p>
        <StravaConnectButton
          onClick={() => {
            login();
            onClose();
          }}
        />
      </div>
    </Dialog>
  );
}
