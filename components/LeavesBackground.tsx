"use client";

import { useCallback, useSyncExternalStore } from "react";
import { FallingLeaves } from "falling-leaves/react";

const KEY = "ogwashi-leaves";
const EVENT = "ogwashi-leaves-change";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

// Whether the leaves are switched on, and a way to switch them.
// The choice is remembered on this device.
export function useLeaves(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, isOn, () => true);
  const setOn = useCallback((value: boolean) => {
    try {
      localStorage.setItem(KEY, value ? "on" : "off");
    } catch {
      // Private mode can block storage. The switch still works until reload.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, setOn];
}

// One layer of falling leaves over every screen. It ignores taps and clicks,
// and the library stops animating for people whose device asks for reduced
// motion. Kept to a modest number of leaves to go easy on phone batteries.
export default function LeavesBackground() {
  const [on] = useLeaves();
  if (!on) return null;
  return (
    <FallingLeaves
      fullScreen
      shapes={["maple"]}
      count={18}
      opacity={0.9}
    />
  );
}
