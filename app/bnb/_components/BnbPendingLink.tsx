"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";

type BnbPendingLinkProps = Omit<ComponentProps<typeof Link>, "children"> & {
  children: ReactNode;
  pendingLabel?: string;
};

export function BnbPendingLink({ children, className = "", pendingLabel = "Loading page", ...props }: BnbPendingLinkProps) {
  return (
    <Link {...props} className={`bnb-pending-link ${className}`.trim()}>
      <span className="bnb-pending-link-content">{children}</span>
      <BnbLinkPendingIndicator label={pendingLabel} />
    </Link>
  );
}

function BnbLinkPendingIndicator({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <span
      className="bnb-link-pending-indicator"
      data-pending={pending ? "true" : "false"}
      aria-live="polite"
      aria-atomic="true"
    >
      {pending ? <BnbButtonLoader /> : null}
      {pending ? <span className="bnb-sr-only">{label}</span> : null}
    </span>
  );
}
