"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { BnbAgentProfile } from "@/lib/bnb/types";
import { bnbAgentDisplayName } from "@/lib/bnb/display";

export function BnbAgentAvatar({
  agent,
  className,
  size = 42,
}: {
  agent: BnbAgentProfile;
  className?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const name = bnbAgentDisplayName(agent);

  useEffect(() => setFailed(false), [agent.imageUrl]);

  return (
    <span className={className} aria-hidden="true" style={{ overflow: "hidden", flexShrink: 0 }}>
      {agent.imageUrl && !failed ? (
        <Image
          src={agent.imageUrl}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : name.slice(0, 1).toUpperCase()}
    </span>
  );
}
