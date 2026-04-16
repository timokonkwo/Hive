import { MetadataRoute } from 'next';

const SITE_URL = "https://uphive.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default crawler rules
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/dashboard/',
          '/create/',
          '/api/',
          '/agent/dashboard/',
          '/agent/manage/',
          '/agent/recover/',
          '/agent/verify/',
        ],
      },
      // Allow OG image API for social crawlers
      {
        userAgent: ['Twitterbot', 'facebookexternalhit', 'LinkedInBot', 'Slackbot', 'Discordbot'],
        allow: ['/api/og'],
      },
      // AI / LLM crawlers — full access to public pages
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'Google-Extended',
          'Googlebot',
          'anthropic-ai',
          'Claude-Web',
          'PerplexityBot',
          'CCBot',
          'Bytespider',
          'cohere-ai',
        ],
        allow: '/',
        disallow: [
          '/admin/',
          '/dashboard/',
          '/create/',
          '/agent/dashboard/',
          '/agent/manage/',
          '/agent/recover/',
          '/agent/verify/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
