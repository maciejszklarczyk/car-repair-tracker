import { useSyncExternalStore } from "react";
import type { Repair } from "@/types";

let repairs: Repair[] | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function resetRepairsStore(): void {
  repairs = null;
  listeners.clear();
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Repair[] | null {
  return typeof window === "undefined" ? null : repairs;
}

export function useRepairsStore(initialRepairs: Repair[]): [Repair[], (id: string) => void] {
  const isServer = typeof window === "undefined";
  if (!isServer) {
    repairs ??= initialRepairs;
  }

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null) ?? initialRepairs;

  function deleteRepair(id: string): void {
    if (isServer) {
      return;
    }
    repairs = (repairs ?? initialRepairs).filter((r) => r.id !== id);
    notify();
  }

  return [snapshot, deleteRepair];
}
