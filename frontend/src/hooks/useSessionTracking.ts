import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";

const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute

/**
 * useSessionTracking — sends session data to the backend analytics API.
 *
 * - Creates a session on mount (POST /api/sessions/start)
 * - Sends heartbeat every 60s (PATCH /api/sessions/:id/heartbeat)
 * - Records each route change as a page view (POST /api/sessions/:id/pageview)
 * - Ends the session on unmount/beforeunload (PATCH /api/sessions/:id/end)
 *
 * Only activates when a JWT token is present in localStorage.
 */
export function useSessionTracking() {
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pageEnteredRef = useRef<number>(Date.now());

  const endSession = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    // Use sendBeacon for reliability on page unload
    const token = localStorage.getItem("token");
    if (token) {
      const url = `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/sessions/${sid}/end`;
      // Use fetch with keepalive for reliability on page unload
      try {
        fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
          keepalive: true,
        }).catch(() => {
          // Ignore errors on unload
        });
      } catch {
        // Ignore
      }
    }

    sessionIdRef.current = null;
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Start session on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let cancelled = false;

    const start = async () => {
      try {
        const res = await api.post("/sessions/start");
        if (cancelled) return;
        const sid = res.data?.data?.session?.id;
        if (sid) {
          sessionIdRef.current = sid;

          // Start heartbeat
          heartbeatRef.current = setInterval(async () => {
            try {
              await api.patch(`/sessions/${sid}/heartbeat`);
            } catch {
              // Silently ignore heartbeat failures
            }
          }, HEARTBEAT_INTERVAL_MS);
        }
      } catch {
        // Session tracking is non-critical
      }
    };

    start();

    // End session on page close
    const handleUnload = () => endSession();
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", handleUnload);
      endSession();
    };
  }, [endSession]);

  // Record page views on route change
  useEffect(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    // Calculate duration on previous page
    const now = Date.now();
    const prevDuration = Math.floor((now - pageEnteredRef.current) / 1000);
    pageEnteredRef.current = now;

    // Record the page view (fire and forget)
    api
      .post(`/sessions/${sid}/pageview`, {
        path: location.pathname,
        duration: prevDuration > 0 ? prevDuration : undefined,
      })
      .catch(() => {
        // Non-critical
      });
  }, [location.pathname]);
}
