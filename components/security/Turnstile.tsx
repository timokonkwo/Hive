"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    __hiveTurnstileLoaded?: () => void;
  }
}

type TurnstileProps = {
  siteKey?: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
};

let scriptLoading = false;

export function Turnstile({ siteKey, onVerify, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "dark",
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
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onVerify, onExpire]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="min-h-[65px]" />;
}
