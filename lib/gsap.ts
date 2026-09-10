"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Hook to animate an integer counter smoothly using GSAP.
 * @param targetValue - Target number to reach.
 * @param duration - Animation duration in seconds (default 1.5s).
 */
export function useGsapCounter(targetValue: number, duration: number = 1.4) {
  const countRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef<number>(0);

  useEffect(() => {
    const el = countRef.current;
    if (!el || typeof window === "undefined") return;

    const startVal = prevValueRef.current;
    const obj = { val: startVal };

    gsap.to(obj, {
      val: targetValue,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = Math.round(obj.val).toLocaleString();
      },
      onComplete: () => {
        prevValueRef.current = targetValue;
      },
    });
  }, [targetValue, duration]);

  return countRef;
}

/**
 * Animate a list of DOM elements with a staggered slide-up entrance.
 * @param containerSelector - CSS selector or parent element.
 * @param itemSelector - Selector for child items.
 * @param stagger - Stagger delay in seconds (default 0.08s).
 */
export function animateStagger(
  container: HTMLElement | null,
  itemSelector: string,
  stagger: number = 0.08
) {
  if (!container || typeof window === "undefined") return;

  const items = container.querySelectorAll(itemSelector);
  if (!items.length) return;

  gsap.fromTo(
    items,
    { opacity: 0, y: 16 },
    {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger,
      ease: "power3.out",
      clearProps: "transform",
    }
  );
}
