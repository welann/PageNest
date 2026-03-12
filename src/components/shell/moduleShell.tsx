import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode
} from "react";

export interface ModuleSidebarSlot {
  description?: string;
  moduleSlug: string;
  panel: ReactNode;
  title: string;
}

const ModuleShellStateContext = createContext<ModuleSidebarSlot | null>(null);
const ModuleShellActionsContext = createContext<
  ((slot: ModuleSidebarSlot | null) => void) | null
>(null);

export function ModuleShellProvider({ children }: { children: ReactNode }) {
  const [activeSidebarSlot, setSidebarSlotState] = useState<ModuleSidebarSlot | null>(null);

  const setActiveSidebarSlot = useCallback((slot: ModuleSidebarSlot | null) => {
    setSidebarSlotState(slot);
  }, []);

  return (
    <ModuleShellActionsContext.Provider value={setActiveSidebarSlot}>
      <ModuleShellStateContext.Provider value={activeSidebarSlot}>
        {children}
      </ModuleShellStateContext.Provider>
    </ModuleShellActionsContext.Provider>
  );
}

export function useActiveSidebarSlot() {
  return useContext(ModuleShellStateContext);
}

export function useSetActiveSidebarSlot() {
  const context = useContext(ModuleShellActionsContext);

  if (!context) {
    throw new Error("useSetActiveSidebarSlot must be used within ModuleShellProvider.");
  }

  return context;
}
