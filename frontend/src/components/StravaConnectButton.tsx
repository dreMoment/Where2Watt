import Image from "next/image";

interface StravaConnectButtonProps {
  onClick: () => void;
  className?: string;
  imageClassName?: string;
}

export default function StravaConnectButton({ onClick, className = "", imageClassName = "" }: StravaConnectButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Connect with Strava"
      className={`inline-flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc4c02] focus-visible:ring-offset-2 ${className}`}
    >
      <Image
        src="/btn_strava_connect_with_orange_x2.png"
        alt="Connect with Strava"
        width={237}
        height={48}
        className={`h-auto w-[237px] max-w-full ${imageClassName}`}
      />
    </button>
  );
}
