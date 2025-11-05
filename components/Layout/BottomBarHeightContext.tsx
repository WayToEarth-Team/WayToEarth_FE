import React, { createContext, useContext, useState, useMemo } from "react";

type Ctx = {
  height: number;
  setHeight: (h: number) => void;
};

const BottomBarHeightContext = createContext<Ctx | undefined>(undefined);

export function BottomBarHeightProvider({ children, initial = 70 }: { children: React.ReactNode; initial?: number }) {
  const [height, setHeight] = useState<number>(initial);
  const value = useMemo(() => ({ height, setHeight }), [height]);
  return (
    <BottomBarHeightContext.Provider value={value}>{children}</BottomBarHeightContext.Provider>
  );
}

export function useBottomBarHeight() {
  const ctx = useContext(BottomBarHeightContext);
  if (!ctx) return { height: 70, setHeight: (_: number) => {} };
  return ctx;
}

