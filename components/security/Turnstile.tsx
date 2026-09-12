"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    __hiveTurnstileLoaded?: () => void;
  }
}

type TurnstileProps = {
  siteKey?: string;
  theme?: "light" | "dark";
  size?: "normal" | "compact";
  onVerify: (token: string) => void;
  onExpire?: () => void;
};

let scriptLoading = false;

export function Turnstile({ siteKey, onVerify, onExpire, theme = "dark", size = "normal" }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        size,
        callback: onVerify,
        "expired-callback": () => {
          onExpire?.();
        },
        "error-callback": () => {
          onExpire?.();
        },
      }) || null;
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      window.__hiveTurnstileLoaded = renderWidget;
      if (!scriptLoading) {
        scriptLoading = true;
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__hiveTurnstileLoaded&render=explicit";
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          scriptLoading = false;
          script.remove();
          onExpire?.();
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onVerify, onExpire, theme, size]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="min-h-[65px]" />;
}
