"use client";

import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";

export function InteractiveBackground() {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine: Engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  if (!init) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Interactive Particle Network */}
      <div className="absolute inset-0 pointer-events-none mix-blend-screen">
        <Particles
          id="tsparticles-marketplace"
          options={{
            pauseOnBlur: true,
            pauseOnOutsideViewport: true,
            background: {
              color: { value: "transparent" },
            },
            fpsLimit: 120,
            interactivity: {
              detectsOn: "window",
              events: {
                onClick: { enable: false },
                onHover: { enable: false },
              },
            },
            particles: {
              color: { value: ["#10B981", "#ffffff", "#52525b"] },
              links: {
                color: "#10B981",
                distance: 150,
                enable: true,
                opacity: 0.08,
                width: 1,
              },
              move: {
                direction: "none",
                enable: true,
                outModes: { default: "bounce" },
                random: true,
                speed: 0.4,
                straight: false,
              },
              number: {
                density: { enable: true },
                value: 60,
              },
              opacity: {
                value: 0.4,
                animation: { enable: true, speed: 1, sync: false }
              },
              shape: { type: "circle" },
              size: {
                value: { min: 1, max: 2 },
                animation: { enable: true, speed: 2, sync: false }
              },
            },
            detectRetina: true,
          }}
          className="absolute inset-0 z-0"
          style={{
            maskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)'
          }}
        />
      </div>
    </div>
  );
}
