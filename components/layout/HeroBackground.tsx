"use client";

import React from "react";
import { ThreeCanvas } from "@/components/ui/ThreeCanvas";
import { useTheme } from "@/components/providers/ThemeProvider";

export function HeroBackground() {
  const { isDark } = useTheme();

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-colors duration-300"
      style={{ background: isDark ? "#000000" : "#FFFFFF" }}
      aria-hidden="true"
    >
      {/* ThreeUI WebGL Neural Constellation */}
      <ThreeCanvas density={95} interactive={true} />

      {/* Subtle radial ambient vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: isDark
            ? "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 200, 5, 0.12), transparent 70%)"
            : "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 168, 4, 0.08), transparent 70%)",
        }}
      />

      {/* Micro-grid overlay for texture */}
      <div
        className="absolute inset-0 opacity-[0.03] transition-opacity duration-300"
        style={{
          backgroundImage: isDark
            ? "linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)"
            : "linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}
