"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";

export function HeroBackground() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { theme } = useTheme();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-colors duration-300" style={{ background: isDark ? '#020202' : '#FAFAFA' }}>
      {/* Hexagonal Grid Overlay */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundImage: `url('/images/hex-grid.svg')`,
          backgroundSize: '40px 40px',
          opacity: isDark ? 0.15 : 0.06,
          filter: isDark ? 'none' : 'invert(1)',
        }}
      ></div>

      {/* Cursor Spotlight */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isDark ? 0.2 : 0.08,
          background: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, ${isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(5, 150, 105, 0.15)'}, transparent 80%)`,
          maskImage: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
          WebkitMaskImage: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`
        }}
      >
         <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `url('/images/hex-grid.svg')`,
              backgroundSize: '40px 40px',
              filter: isDark ? 'none' : 'invert(1)',
            }}
          ></div>
      </div>

      {/* Radial Gradient Mesh - Breathing */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] animate-breathe mix-blend-screen transition-colors duration-300"
        style={{ background: isDark ? 'rgba(4, 120, 87, 0.1)' : 'rgba(5, 150, 105, 0.04)' }}
      ></div>

      {/* Noise Overlay */}
      <div className="bg-noise"></div>
    </div>
  );
}
