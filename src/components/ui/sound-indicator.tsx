import { Volume2 } from "lucide-react";

/**
 * Speaker indicator marking buttons that play sound on tap.
 * Pair with the `.btn-sound` class for the site-wide soundable design.
 */
export function SoundIndicator({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <Volume2 className={`sound-ico ${className}`} aria-hidden="true" />
  );
}
