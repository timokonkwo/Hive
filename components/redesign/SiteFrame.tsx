"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const LegacyAppFrame = dynamic(() => import("./LegacyAppFrame"));

/** The new home has its own presentation. App pages move only after approval. */
export function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname === "/" ? children : <LegacyAppFrame>{children}</LegacyAppFrame>;
}
