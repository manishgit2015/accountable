import { WifiOff } from "lucide-react";

import { MESSAGES } from "../api/client";

/** REL-7: shown while the backend can't be reached. Data on screen stays; saving waits. */
export function OfflineBanner({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <div className="offline-banner" role="alert">
      <WifiOff size={18} aria-hidden="true" />
      {MESSAGES.unreachable}
    </div>
  );
}
