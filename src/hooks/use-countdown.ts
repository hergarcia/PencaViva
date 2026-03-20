import { useState, useEffect } from "react";

function computeSecondsRemaining(targetMs: number): number {
  return Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
}

function formatCountdown(seconds: number): string {
  if (seconds === 0) return "";
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  return `${seconds}s`;
}

export function useCountdown(targetDate: string | Date | null): {
  secondsRemaining: number;
  isExpired: boolean;
  formatted: string;
} {
  const targetMs = targetDate ? new Date(targetDate).getTime() : null;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    targetMs !== null ? computeSecondsRemaining(targetMs) : 0,
  );

  useEffect(() => {
    if (targetMs === null) {
      setSecondsRemaining(0);
      return;
    }
    // Sync immediately when targetMs changes (no off-by-one on mount)
    setSecondsRemaining(computeSecondsRemaining(targetMs));

    const id = setInterval(() => {
      setSecondsRemaining(computeSecondsRemaining(targetMs));
    }, 1000);

    return () => clearInterval(id);
  }, [targetMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    secondsRemaining,
    isExpired: secondsRemaining === 0,
    formatted: formatCountdown(secondsRemaining),
  };
}
