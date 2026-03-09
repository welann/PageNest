import { startTransition, useEffect, useState } from "react";

import { createMockDashboard } from "@features/home/mockDashboard";
import { getDashboardSnapshot } from "@services/api/dashboard";
import type { DashboardSnapshot } from "@shared/types/api";

type DashboardStatus = "loading" | "ready" | "fallback";

interface DashboardState {
  dashboard: DashboardSnapshot;
  status: DashboardStatus;
}

const initialState: DashboardState = {
  dashboard: createMockDashboard(),
  status: "loading"
};

export function useHomeDashboard() {
  const [state, setState] = useState<DashboardState>(initialState);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSnapshot() {
      try {
        const dashboard = await getDashboardSnapshot(controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setState({
            dashboard,
            status: "ready"
          });
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setState({
            dashboard: createMockDashboard(),
            status: "fallback"
          });
        });
      }
    }

    loadSnapshot();

    return () => {
      controller.abort();
    };
  }, []);

  return state;
}

