"use client";

import { useEffect, useRef } from "react";
import { StaticSculpture } from "./BrandMark";
import type { HiveTheme } from "./theme";
import styles from "./landing.module.css";

/** A dimensional treatment of the established Hive logo, using its exact SVG paths. */
export default function BrandScene({ theme, paused }: { theme: HiveTheme; paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const updateTheme = useRef<((theme: HiveTheme) => void) | null>(null);
  const updatePause = useRef<(() => void) | null>(null);
  const currentTheme = useRef(theme);
  const currentPause = useRef(paused);

  useEffect(() => { currentTheme.current = theme; updateTheme.current?.(theme); }, [theme]);
  useEffect(() => { currentPause.current = paused; updatePause.current?.(); }, [paused]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    async function mount() {
      const [THREE, { RoomEnvironment }, { SVGLoader }, { gsap }] = await Promise.all([
        import("three"), import("three/addons/environments/RoomEnvironment.js"),
        import("three/addons/loaders/SVGLoader.js"), import("gsap"),
      ]);
      if (cancelled || !element) return;
      const logo = await new SVGLoader().loadAsync("/images/hive-icon.svg");
      if (cancelled) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
      catch { return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      element.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0.15, 10.5);
      camera.lookAt(0, 0, 0);
      const generator = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const environment = generator.fromScene(room, 0.04);
      scene.environment = environment.texture;
      room.dispose(); generator.dispose();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x36431c, 2));
      const key = new THREE.DirectionalLight(0xf2ffda, 4);
      key.position.set(-3, 6, 4); scene.add(key);
      const rim = new THREE.DirectionalLight(0xccff00, 3);
      rim.position.set(5, -1, -4); scene.add(rim);
      const sculpture = new THREE.Group(); scene.add(sculpture);
      const pieces: InstanceType<typeof THREE.Mesh>[] = [];
      const geometries: InstanceType<typeof THREE.ExtrudeGeometry>[] = [];
      const materials: InstanceType<typeof THREE.MeshPhysicalMaterial>[] = [];
      for (const path of logo.paths) {
        const material = new THREE.MeshPhysicalMaterial({ color: path.color, metalness: 0.28, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.9 });
        materials.push(material);
        for (const shape of SVGLoader.createShapes(path)) {
          const geometry = new THREE.ExtrudeGeometry(shape, { depth: 15, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.5, bevelThickness: 0.5, curveSegments: 12 });
          geometry.translate(-135, -134.5, -7.5); geometry.scale(0.015, -0.015, 0.015); geometries.push(geometry);
          const piece = new THREE.Mesh(geometry, material); sculpture.add(piece); pieces.push(piece);
        }
      }
      sculpture.rotation.set(0.02, -0.14, 0);
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const pointer = { x: 0, y: 0 };
      let visible = true, lost = false, frame = 0, phase = 0, previous = 0;
      let assembly: ReturnType<typeof gsap.timeline> | undefined;
      const draw = () => renderer.render(scene, camera);
      const canMove = () => visible && !document.hidden && !currentPause.current && !motion.matches && !lost;
      function render(time: number) {
        frame = 0; if (!canMove()) return;
        phase += previous ? Math.min((time - previous) / 1000, 0.05) : 0; previous = time;
        sculpture.rotation.y += ((-0.12 + pointer.x * 0.2 + Math.sin(phase * 0.22) * 0.1) - sculpture.rotation.y) * 0.055;
        sculpture.rotation.x += ((0.04 + pointer.y * 0.12) - sculpture.rotation.x) * 0.055;
        sculpture.position.y = Math.sin(phase * 0.5) * 0.055;
        draw(); frame = requestAnimationFrame(render);
      }
      function syncMotion() {
        cancelAnimationFrame(frame); frame = 0; previous = 0;
        if (motion.matches || currentPause.current) assembly?.progress(1).pause();
        else if (canMove()) assembly?.resume(); else assembly?.pause();
        if (canMove()) frame = requestAnimationFrame(render); else if (!lost) draw();
      }
      const resize = new ResizeObserver(() => {
        const { width, height } = element!.getBoundingClientRect(); if (!width || !height || lost) return;
        renderer.setSize(width, height); camera.aspect = width / height;
        camera.position.z = width < 440 ? 11.2 : 10.5; camera.updateProjectionMatrix(); draw();
      }); resize.observe(element);
      const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncMotion(); }, { threshold: 0.05 }); intersection.observe(element);
      const onPointer = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" || !canMove()) return;
        const bounds = element!.getBoundingClientRect();
        pointer.x = (event.clientX - bounds.left) / bounds.width - 0.5; pointer.y = (event.clientY - bounds.top) / bounds.height - 0.5;
      };
      const onLeave = () => { pointer.x = 0; pointer.y = 0; };
      const onContextLoss = (event: Event) => { event.preventDefault(); lost = true; element!.dataset.ready = "false"; cancelAnimationFrame(frame); assembly?.pause(); };
      element.addEventListener("pointermove", onPointer); element.addEventListener("pointerleave", onLeave);
      renderer.domElement.addEventListener("webglcontextlost", onContextLoss);
      document.addEventListener("visibilitychange", syncMotion); motion.addEventListener("change", syncMotion);
      updateTheme.current = (mode) => { renderer.toneMappingExposure = mode === "dark" ? 1.05 : 0.9; if (!lost) draw(); };
      updatePause.current = syncMotion; updateTheme.current(currentTheme.current);
      const bounds = element.getBoundingClientRect(); renderer.setSize(bounds.width, bounds.height);
      camera.aspect = bounds.width / Math.max(bounds.height, 1); camera.updateProjectionMatrix(); draw(); element.dataset.ready = "true";
      if (!motion.matches && !currentPause.current) {
        assembly = gsap.timeline();
        pieces.forEach((piece, i) => assembly!.fromTo(piece.position, { z: -0.8, y: 0.3 }, { z: 0, y: 0, duration: 1.1, ease: "expo.out" }, i * 0.045));
      }
      syncMotion();
      dispose = () => {
        cancelAnimationFrame(frame); assembly?.kill(); resize.disconnect(); intersection.disconnect();
        element!.removeEventListener("pointermove", onPointer); element!.removeEventListener("pointerleave", onLeave);
        document.removeEventListener("visibilitychange", syncMotion); motion.removeEventListener("change", syncMotion);
        renderer.domElement.removeEventListener("webglcontextlost", onContextLoss);
        geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); environment.dispose();
        renderer.dispose(); renderer.domElement.remove(); updateTheme.current = null; updatePause.current = null; delete element!.dataset.ready;
      };
    }
    mount().catch(() => { /* Keep the static logo if the renderer cannot load. */ });
    return () => { cancelled = true; dispose?.(); };
  }, []);
  return <div className={styles.scene} ref={host} aria-hidden="true"><div className={styles.sceneFallback}><StaticSculpture /></div></div>;
}
