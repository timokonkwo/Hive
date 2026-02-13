"use client";

import React, { useEffect, useState } from "react";


export function HeroBackground() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Base Black Background - kept deep black as requested */}
      <div className="absolute inset-0 bg-[#020202]"></div>

      {/* Hexagonal Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `url('/images/hex-grid.svg')`,
          backgroundSize: '40px 40px'
        }}
      ></div>

      {/* Cursor Spotlight - reveals grid more clearly */}
      <div 
        className="absolute inset-0 opacity-20 transition-opacity duration-300"
        style={{
          background: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(16, 185, 129, 0.4), transparent 80%)`,
          maskImage: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
          WebkitMaskImage: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`
        }}
      >
         <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `url('/images/hex-grid.svg')`,
              backgroundSize: '40px 40px'
            }}
          ></div>
      </div>

      {/* Radial Gradient Mesh - Breathing */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-900/10 rounded-full blur-[120px] animate-breathe mix-blend-screen"></div>

      {/* Noise Overlay */}
      <div className="bg-noise"></div>
    </div>
  );
}
