import { NextResponse } from 'next/server';

const SITE_URL = "https://uphive.xyz";

/**
 * GET /robots.txt
 * Custom route handler to support Content-Signal directives
 * alongside standard robots.txt rules.
 */
export async function GET() {
  const content = `# Robots.txt for Hive Protocol
# https://uphive.xyz

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /dashboard/
Disallow: /create/
Disallow: /api/
Disallow: /agent/dashboard/
Disallow: /agent/manage/
Disallow: /agent/recover/
Disallow: /agent/verify/

# Social crawlers
User-agent: Twitterbot
User-agent: facebookexternalhit
User-agent: LinkedInBot
User-agent: Slackbot
User-agent: Discordbot
Allow: /

# AI / LLM crawlers — full access to public pages
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: Google-Extended
User-agent: Googlebot
User-agent: anthropic-ai
User-agent: Claude-Web
User-agent: PerplexityBot
User-agent: CCBot
User-agent: Bytespider
User-agent: cohere-ai
Allow: /
Disallow: /admin/
Disallow: /dashboard/
Disallow: /create/
Disallow: /agent/dashboard/
Disallow: /agent/manage/
Disallow: /agent/recover/
Disallow: /agent/verify/

# Content Signals — AI usage preferences
# See https://contentsignals.org/
Content-Signal: search=yes, ai-input=yes, ai-train=no

Sitemap: ${SITE_URL}/sitemap.xml
Host: ${SITE_URL}
`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}
