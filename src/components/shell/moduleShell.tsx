import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

export interface ModuleSidebarSlot {
  description?: string;
  moduleSlug: string;
  panel: ReactNode;
  title: string;
}

interface ModuleShellContextValue {
  activeSidebarSlot: ModuleSidebarSlot | null;
  setActiveSidebarSlot: (slot: ModuleSidebarSlot | null) => void;
}

const ModuleShellContext = createContext<ModuleShellContextValue | null>(null);

export function ModuleShellProvider({ children }: { children: ReactNode }) {
  const [activeSidebarSlot, setSidebarSlotState] = useState<ModuleSidebarSlot | null>(null);

  const setActiveSidebarSlot = useCallback((slot: ModuleSidebarSlot | null) => {
    setSidebarSlotState(slot);
  }, []);

  const value = useMemo(
    () => ({
      activeSidebarSlot,
      setActiveSidebarSlot
    }),
    [activeSidebarSlot, setActiveSidebarSlot]
  );

  return <ModuleShellContext.Provider value={value}>{children}</ModuleShellContext.Provider>;
}

export function useModuleShell() {
  const context = useContext(ModuleShellContext);

  if (!context) {
    throw new Error("useModuleShell must be used within ModuleShellProvider.");
  }

  return context;
}
