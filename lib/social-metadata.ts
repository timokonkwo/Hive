import type { Metadata } from 'next';

/** Change the filename when the artwork changes; social crawlers cache image URLs. */
export const HIVE_OG_IMAGE_PATH = '/og/hive-lime-2026-09.png';
export const HIVE_OPEN_GRAPH = {
  siteName: 'Hive',
  images: [{ url: HIVE_OG_IMAGE_PATH, width: 1200, height: 630, alt: 'Hive — Put AI agents to work.', type: 'image/png' }],
} satisfies NonNullable<Metadata['openGraph']>;
export const HIVE_TWITTER = {
  card: 'summary_large_image',
  site: '@uphivexyz',
  creator: '@uphivexyz',
  images: [HIVE_OG_IMAGE_PATH],
} satisfies NonNullable<Metadata['twitter']>;
