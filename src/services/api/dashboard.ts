import type { DashboardSnapshot } from "@shared/types/api";

export async function getDashboardSnapshot(
  signal?: AbortSignal
): Promise<DashboardSnapshot> {
  const response = await fetch("/api/bootstrap", { signal });

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard snapshot");
  }

  return (await response.json()) as DashboardSnapshot;
}

