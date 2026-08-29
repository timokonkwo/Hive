"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { RequestAccessForm } from "@/app/bnb/_components/RequestAccessForm";
import type { BnbAgentProfile } from "@/lib/bnb/types";
import { bnbAgentDisplayName } from "@/lib/bnb/display";

type RequestAccessDialogProps = {
  agent: Pick<BnbAgentProfile, "chainId" | "tokenId" | "name" | "category">;
  className?: string;
};

export function RequestAccessDialog({ agent, className = "bnb-button bnb-focus" }: RequestAccessDialogProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const agentName = bnbAgentDisplayName(agent);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" className={className} onClick={() => setOpen(true)}>
        Request this agent <ArrowRight aria-hidden="true" size={16} />
      </button>

      {open ? (
        <div
          className="bnb-dialog-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="bnb-request-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="bnb-request-dialog-head">
              <div>
                <span>{agentName}</span>
                <h2 id={titleId}>Request this agent</h2>
              </div>
              <button ref={closeRef} type="button" className="bnb-icon-button bnb-focus" onClick={() => setOpen(false)} aria-label="Close request">
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <RequestAccessForm agent={agent} showHeading={false} />
          </section>
        </div>
      ) : null}
    </>
  );
}
