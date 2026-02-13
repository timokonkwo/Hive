import { MetadataRoute } from 'next';

const SITE_URL = "https://hive.luxenlabs.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/', '/create/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
