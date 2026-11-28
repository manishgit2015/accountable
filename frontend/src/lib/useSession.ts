import { useSyncExternalStore } from "react";

import { session, type SessionState } from "./session";

function subscribe(listener: () => void): () => void {
  const unsubscribe = session().subscribe(listener);
  return () => {
    unsubscribe();
  };
}

/** The session's state, re-rendering when someone signs in or out, or the session ends (R100, R108). */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, () => session().getState());
}
