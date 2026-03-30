"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { apiClient } from "@/lib/api";

export type TwilioCallState =
  | "idle"
  | "connecting"
  | "ringing"
  | "open"        // call is active — mic + speaker flowing
  | "disconnected"
  | "error";

interface UseTwilioDeviceReturn {
  /** Current call state */
  callState: TwilioCallState;
  /** Is the device registered and ready? */
  ready: boolean;
  /** Start a call to the given number */
  makeCall: (toNumber: string, investorId: number) => Promise<void>;
  /** Hang up the active call */
  hangUp: () => void;
  /** Toggle mute */
  toggleMute: () => void;
  /** Is the call muted? */
  isMuted: boolean;
  /** Call duration in seconds (updates every second while connected) */
  duration: number;
  /** Error message if something went wrong */
  error: string | null;
  /** The number currently being called */
  activeNumber: string | null;
  /** Initialize / register the device (call once when Comms tab mounts) */
  init: () => Promise<void>;
  /** Destroy the device (call on unmount) */
  destroy: () => void;
}

export function useTwilioDevice(): UseTwilioDeviceReturn {
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [callState, setCallState] = useState<TwilioCallState>("idle");
  const [ready, setReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeNumber, setActiveNumber] = useState<string | null>(null);

  // Start a timer that ticks every second while call is open
  const startTimer = useCallback(() => {
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (callRef.current) {
        callRef.current.disconnect();
        callRef.current = null;
      }
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, [stopTimer]);

  const init = useCallback(async () => {
    if (deviceRef.current) return; // Already initialized

    try {
      setError(null);
      const { data } = await apiClient.get("/api/twilio/token");
      const token: string = data.token;

      const device = new Device(token, {
        edge: "ashburn",
        logLevel: 1,
      });

      device.on("registered", () => {
        setReady(true);
      });

      device.on("error", (err) => {
        setError(err.message || "Twilio device error");
        setCallState("error");
      });

      device.on("tokenWillExpire", async () => {
        // Refresh token before it expires
        try {
          const { data: refreshData } = await apiClient.get("/api/twilio/token");
          device.updateToken(refreshData.token);
        } catch {
          // Token refresh failed — device will become unregistered
        }
      });

      await device.register();
      deviceRef.current = device;
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to initialize Twilio";
      setError(msg);
    }
  }, []);

  const destroy = useCallback(() => {
    stopTimer();
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }
    if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
    }
    setReady(false);
    setCallState("idle");
  }, [stopTimer]);

  const makeCall = useCallback(
    async (toNumber: string, investorId: number) => {
      if (!deviceRef.current) {
        setError("Twilio device not initialized. Please wait...");
        return;
      }
      if (callRef.current) {
        setError("A call is already in progress");
        return;
      }

      setError(null);
      setCallState("connecting");
      setActiveNumber(toNumber);
      setIsMuted(false);

      try {
        const call = await deviceRef.current.connect({
          params: {
            To: toNumber,
            investorId: String(investorId),
          },
        });

        callRef.current = call;

        call.on("ringing", () => {
          setCallState("ringing");
        });

        call.on("accept", () => {
          setCallState("open");
          startTimer();
        });

        call.on("disconnect", () => {
          setCallState("disconnected");
          stopTimer();
          callRef.current = null;
          // Reset to idle after a brief moment
          setTimeout(() => {
            setCallState("idle");
            setActiveNumber(null);
            setDuration(0);
          }, 2000);
        });

        call.on("cancel", () => {
          setCallState("idle");
          stopTimer();
          callRef.current = null;
          setActiveNumber(null);
        });

        call.on("error", (err) => {
          setError(err.message || "Call error");
          setCallState("error");
          stopTimer();
          callRef.current = null;
        });
      } catch (e: any) {
        setError(e?.message || "Failed to connect call");
        setCallState("error");
        setActiveNumber(null);
      }
    },
    [startTimer, stopTimer]
  );

  const hangUp = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }
    stopTimer();
    setCallState("idle");
    setActiveNumber(null);
    setDuration(0);
  }, [stopTimer]);

  const toggleMute = useCallback(() => {
    if (callRef.current) {
      const newMuted = !callRef.current.isMuted();
      callRef.current.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, []);

  return {
    callState,
    ready,
    makeCall,
    hangUp,
    toggleMute,
    isMuted,
    duration,
    error,
    activeNumber,
    init,
    destroy,
  };
}
