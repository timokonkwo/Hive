"use client";
import { useEffect, useRef } from "react";
import type { HiveTheme } from "./theme";
import styles from "./landing.module.css";
export function SceneBackdrop({ theme, paused }: {
    theme: HiveTheme;
    paused: boolean;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const state = useRef({ theme, paused });
    const refresh = useRef<(() => void) | null>(null);
    useEffect(() => { state.current = { theme, paused }; refresh.current?.(); }, [theme, paused]);
    useEffect(() => {
        const el = canvas.current;
        const parent = el?.parentElement;
        const ctx = el?.getContext("2d");
        if (!el || !ctx || !parent)
            return;
        let width = 0, height = 0, frame = 0, phase = 0, previous = 0, visible = true;
        const pointer = { x: -1000, y: -1000 };
        const reduce = matchMedia("(prefers-reduced-motion: reduce)");
        function draw() {
            if (!ctx)
                return;
            ctx.clearRect(0, 0, width, height);
            const dark = state.current.theme === 'dark';
            const color = dark ? '172,200,120' : '78,109,31';
            // An original contour field. Pointer distance bends the lines and reveals nearby points.
            for (let line = 0; line < 19; line++) {
                ctx.beginPath();
                for (let x = 0; x <= width + 20; x += 16) {
                    const base = height * .7 + line * 18;
                    const distance = Math.hypot(x - pointer.x, base - pointer.y);
                    const lift = reduce.matches || state.current.paused ? 0 : Math.exp(-distance / 200) * 22;
                    const y = base + Math.sin(x / 220 + phase * .25 + line * .18) * 34 - lift;
                    if (x === 0)
                        ctx.moveTo(x, y);
                    else
                        ctx.lineTo(x, y);
                }
                ctx.strokeStyle = `rgba(${color},${dark ? .13 : .12})`;
                ctx.lineWidth = .7;
                ctx.stroke();
            }
            for (let x = 24; x < width; x += 32)
                for (let y = 22; y < height; y += 32) {
                    const distance = Math.hypot(x - pointer.x, y - pointer.y);
                    const near = reduce.matches || state.current.paused ? 0 : Math.max(0, 1 - distance / 170);
                    const right = Math.max(.04, (x / width - .32) * .16);
                    ctx.fillStyle = `rgba(${color},${right + near * .48})`;
                    ctx.beginPath();
                    ctx.arc(x, y, .7 + near * 1.1, 0, Math.PI * 2);
                    ctx.fill();
                }
        }
        const moving = () => !state.current.paused && !reduce.matches && visible && !document.hidden;
        function tick(time: number) { frame = 0; if (!moving())
            return; if (previous && time - previous < 32) {
            frame = requestAnimationFrame(tick);
            return;
        } phase += previous ? Math.min((time - previous) / 1000, .05) : 0; previous = time; draw(); frame = requestAnimationFrame(tick); }
        function sync() { cancelAnimationFrame(frame); frame = 0; previous = 0; draw(); if (moving())
            frame = requestAnimationFrame(tick); }
        refresh.current = sync;
        const resize = new ResizeObserver(() => { const b = parent!.getBoundingClientRect(); width = b.width; height = b.height; const ratio = Math.min(devicePixelRatio, 1.25); el!.width = width * ratio; el!.height = height * ratio; ctx!.setTransform(ratio, 0, 0, ratio, 0, 0); draw(); });
        resize.observe(parent);
        const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
        observer.observe(parent);
        const move = (e: PointerEvent) => { if (e.pointerType !== 'mouse')
            return; const b = parent!.getBoundingClientRect(); pointer.x = e.clientX - b.left; pointer.y = e.clientY - b.top; };
        const leave = () => { pointer.x = -1000; pointer.y = -1000; };
        parent.addEventListener('pointermove', move);
        parent.addEventListener('pointerleave', leave);
        reduce.addEventListener('change', sync);
        document.addEventListener('visibilitychange', sync);
        sync();
        return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); parent.removeEventListener('pointermove', move); parent.removeEventListener('pointerleave', leave); reduce.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); refresh.current = null; };
    }, []);
    return <canvas ref={canvas} className={styles.sceneBackdrop} aria-hidden="true"/>;
}
