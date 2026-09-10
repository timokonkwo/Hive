"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "@/components/providers/ThemeProvider";

interface ThreeCanvasProps {
  interactive?: boolean;
  density?: number;
  className?: string;
}

export function ThreeCanvas({
  interactive = true,
  density = 90,
  className = "",
}: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let isVisible = true;

    // Dimensions
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 1000);
    camera.position.z = 240;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Particle nodes configuration
    const particleCount = density;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    const spreadX = 320;
    const spreadY = 180;
    const spreadZ = 120;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * spreadX;
      positions[i3 + 1] = (Math.random() - 0.5) * spreadY;
      positions[i3 + 2] = (Math.random() - 0.5) * spreadZ;

      velocities[i3] = (Math.random() - 0.5) * 0.15;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.15;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.08;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    // Node colors: Robinhood Neon Green (#00C805)
    const nodeColor = isDark ? 0x00c805 : 0x00a804;
    const particleMaterial = new THREE.PointsMaterial({
      color: nodeColor,
      size: isDark ? 3.5 : 3.0,
      transparent: true,
      opacity: isDark ? 0.85 : 0.75,
      blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // Lines geometry for neural interconnects
    const maxConnections = particleCount * 6;
    const linePositions = new Float32Array(maxConnections * 6);
    const lineColors = new Float32Array(maxConnections * 6);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3)
    );
    lineGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: isDark ? 0.35 : 0.22,
      blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
      linewidth: 1,
    });

    const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(linesMesh);

    // Mouse coordinates
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      if (!interactive) return;
      targetMouseX = (event.clientX / window.innerWidth - 0.5) * 30;
      targetMouseY = (event.clientY / window.innerHeight - 0.5) * 30;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || window.innerHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    // Visibility observer to pause GPU when scrolled away
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(container);

    // Render loop
    const maxDist = 48;
    const maxDistSq = maxDist * maxDist;

    const rgbNode = isDark ? [0, 0.78, 0.02] : [0, 0.65, 0.02];

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;

      // Smooth camera parallax
      currentMouseX += (targetMouseX - currentMouseX) * 0.04;
      currentMouseY += (targetMouseY - currentMouseY) * 0.04;
      camera.position.x = currentMouseX;
      camera.position.y = -currentMouseY;
      camera.lookAt(scene.position);

      const pos = particleGeometry.attributes.position.array as Float32Array;

      // Update particle positions
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        pos[i3] += velocities[i3];
        pos[i3 + 1] += velocities[i3 + 1];
        pos[i3 + 2] += velocities[i3 + 2];

        // Boundary rebound
        if (pos[i3] < -spreadX / 2 || pos[i3] > spreadX / 2) velocities[i3] *= -1;
        if (pos[i3 + 1] < -spreadY / 2 || pos[i3 + 1] > spreadY / 2)
          velocities[i3 + 1] *= -1;
        if (pos[i3 + 2] < -spreadZ / 2 || pos[i3 + 2] > spreadZ / 2)
          velocities[i3 + 2] *= -1;
      }
      particleGeometry.attributes.position.needsUpdate = true;

      // Connect near nodes
      let lineIndex = 0;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        for (let j = i + 1; j < particleCount; j++) {
          const j3 = j * 3;
          const dx = pos[i3] - pos[j3];
          const dy = pos[i3 + 1] - pos[j3 + 1];
          const dz = pos[i3 + 2] - pos[j3 + 2];
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < maxDistSq && lineIndex < maxConnections * 6) {
            const alpha = 1.0 - distSq / maxDistSq;

            linePositions[lineIndex] = pos[i3];
            linePositions[lineIndex + 1] = pos[i3 + 1];
            linePositions[lineIndex + 2] = pos[i3 + 2];

            linePositions[lineIndex + 3] = pos[j3];
            linePositions[lineIndex + 4] = pos[j3 + 1];
            linePositions[lineIndex + 5] = pos[j3 + 2];

            lineColors[lineIndex] = rgbNode[0] * alpha;
            lineColors[lineIndex + 1] = rgbNode[1] * alpha;
            lineColors[lineIndex + 2] = rgbNode[2] * alpha;

            lineColors[lineIndex + 3] = rgbNode[0] * alpha;
            lineColors[lineIndex + 4] = rgbNode[1] * alpha;
            lineColors[lineIndex + 5] = rgbNode[2] * alpha;

            lineIndex += 6;
          }
        }
      }

      lineGeometry.setDrawRange(0, lineIndex / 3);
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      observer.disconnect();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      particleGeometry.dispose();
      particleMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    };
  }, [interactive, density, isDark]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    />
  );
}
