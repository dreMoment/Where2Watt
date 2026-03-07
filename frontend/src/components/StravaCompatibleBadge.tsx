import Image from "next/image";

interface StravaCompatibleBadgeProps {
  className?: string;
}

export default function StravaCompatibleBadge({ className = "" }: StravaCompatibleBadgeProps) {
  return (
    <a
      href="https://www.strava.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Compatible with Strava"
      className={`inline-flex items-center justify-center ${className}`}
    >
      <Image
        src="/api_logo_cptblWith_strava_horiz_orange.png"
        alt="Compatible with Strava"
        width={219}
        height={19}
        className="h-auto w-[219px] max-w-full"
      />
    </a>
  );
}
