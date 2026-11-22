import { useEffect, useRef } from "react";
import { useError } from "@/components/providers/ErrorProvider";
import { buildMirrorState, isNativeApp, postNative } from "@/lib/native-bridge";
import { restNotificationsEnabled } from "@/lib/rest-notifications";
import type { ActiveSession } from "@/lib/types";

/**
 * Inside the iOS app, tells native when the set/rest state changes so it can schedule the
 * rest-complete notification and mirror the workout to the Apple Watch. Re-posts only on
 * position/rest changes, not on every one-second timer tick.
 */
export function useNativeMirror(session: ActiveSession | null) {
  const { showError } = useError();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const active = Boolean(session && !session.ended);
  const exerciseIndex = session?.currentExerciseIndex;
  const setNumber = session?.currentSetNumber;
  const isResting = session?.isResting;

  useEffect(() => {
    if (!isNativeApp()) return;
    try {
      const current = sessionRef.current;
      const state = active && current ? buildMirrorState(current, Date.now(), restNotificationsEnabled()) : null;
      postNative("workoutState", state);
    } catch (error) {
      showError(error);
    }
  }, [active, exerciseIndex, setNumber, isResting, showError]);
}
