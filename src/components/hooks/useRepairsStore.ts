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

export function useRepairsStore(initialRepairs: Repair[]): [Repair[], (id: string) => void] {
  function subscribe(listener: () => void): () => void {
    repairs ??= initialRepairs;
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getSnapshot(): Repair[] {
    return repairs ?? initialRepairs;
  }

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => initialRepairs);

  function deleteRepair(id: string): void {
    repairs = (repairs ?? initialRepairs).filter((r) => r.id !== id);
    notify();
  }

  return [snapshot, deleteRepair];
}
