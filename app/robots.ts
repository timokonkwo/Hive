import { MetadataRoute } from 'next';

const SITE_URL = "https://uphive.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/', '/create/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
