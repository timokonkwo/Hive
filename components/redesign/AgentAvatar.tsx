"use client";
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { createAvatar } from '@dicebear/core';
import * as bottts from '@dicebear/bottts';

/** Use the same public ID in directory and profile for a consistent generated identity. */
export function AgentAvatar({ id, name, className, size = 48, seed, imageUrl }: { id: string; name: string; className: string; size?: number; seed?: string; imageUrl?: string }) {
  const [failedSource, setFailedSource] = useState('');
  const source = useMemo(() => imageUrl || createAvatar(bottts, { seed: seed || id, backgroundColor: ['e9eddf'], size: 48 }).toDataUri(), [imageUrl, seed, id]);
  return <span className={className} aria-hidden="true">{failedSource === source ? name.slice(0, 2).toUpperCase() : <Image unoptimized src={source} width={size} height={size} alt="" onError={() => setFailedSource(source)} />}</span>;
}
