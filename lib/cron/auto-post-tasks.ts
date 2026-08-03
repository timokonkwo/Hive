/**
 * Auto-Post Tasks
 * 
 * Creates and publishes unique system-seeded tasks on a schedule using Gemini.
 * Each run generates fresh, useful marketplace work while marking it as
 * scheduled Hive activity instead of pretending it came from an outside client.
 * Budget range: $0.50-$3 USDC, weighted toward $1.
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { generateWithGemini } from '@/lib/stealth-agents/gemini';
import { rankAgentsForTask } from '@/lib/smart-matching';

export const SCHEDULED_TASK_SOURCE = 'hive-scheduled-marketplace';

// Visible system client pool for scheduled task creation.
const SYSTEM_CLIENT_POOL = [
  { name: 'Hive Activity Lab', address: 'did:privy:cl_hive_activity_lab' },
  { name: 'Hive Build Bench', address: 'did:privy:cl_hive_build_bench' },
  { name: 'Hive Research Desk', address: 'did:privy:cl_hive_research_desk' },
  { name: 'Hive QA Queue', address: 'did:privy:cl_hive_qa_queue' },
  { name: 'Hive Ops Studio', address: 'did:privy:cl_hive_ops_studio' },
];

function getIntEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

// Categories with descriptions and example tasks to guide Gemini
const CATEGORIES = [
  {
    name: 'Development',
    weight: 70,
    guidance: 'Code tasks: scripts, APIs, unit tests, CI/CD pipelines, refactoring, automation, CLI tools. Languages: Python, TypeScript, Node.js, Bash.',
    examples: [
      {
        title: 'Write a Python script to scrape product prices from 3 competitor websites',
        description: 'Build a Python script that scrapes product pricing from **Amazon, eBay, and AliExpress** for a given keyword.\n\n**Deliverables:**\n- CSV output with columns: product name, price, seller, URL, scraped_at timestamp\n- Rate limiting and rotating user agents\n- Basic error recovery and retry logic\n- `requirements.txt` and usage instructions',
      },
      {
        title: 'Build a REST API endpoint that validates and cleans CSV uploads',
        description: 'Create an Express.js endpoint (POST /api/upload) that accepts a CSV file, validates column headers match a provided schema, removes duplicate rows, normalizes all dates to ISO 8601, and fills missing fields with configurable defaults. Return the cleaned data as JSON. Include input validation, error responses with clear messages, and a sample CSV for testing.',
      },
      {
        title: 'Create a GitHub Actions CI/CD pipeline for a Node.js project',
        description: 'Write a complete **GitHub Actions** workflow YAML for a Node.js monorepo.\n\n**Pipeline stages:**\n- Install dependencies (with caching)\n- Run ESLint\n- Run Jest tests with **80% coverage threshold**\n- Build for production\n- Deploy to Vercel on push to `main`\n\nInclude environment variable handling, Slack notification on failure, and a manual deploy trigger for staging.',
      },
      {
        title: 'Write a Bash script to automate daily PostgreSQL backups to S3',
        description: 'Create a production-ready Bash script that performs a pg_dump of a PostgreSQL database, compresses the output with gzip, uploads it to an S3 bucket with a timestamped filename, and deletes local and remote backups older than 30 days. Include logging to a file, error handling with exit codes, and a recommended cron schedule. Deliver the script plus setup guide.',
      },
      {
        title: 'Write unit tests for a user authentication module',
        description: 'Given a Node.js authentication module with signup, login, password reset, and token refresh endpoints, write comprehensive Jest tests. Cover valid inputs, invalid inputs, edge cases like expired JWTs, duplicate emails, and weak passwords. Mock external dependencies (database, email service). Target 90%+ code coverage. Deliver the test file and a coverage report.',
      },
      {
        title: 'Build a CLI tool that converts JSON config files to environment variables',
        description: 'Write a Node.js CLI tool that reads a nested JSON config file (e.g. {"db": {"host": "...", "port": 5432}}) and outputs a flat .env file (DB_HOST=..., DB_PORT=5432). Support multiple environments (dev, staging, prod) via a --env flag. Handle arrays, booleans, and null values gracefully. Include --dry-run mode, validation for missing required keys, and npm publishing instructions.',
      },
      {
        title: 'Refactor a monolithic Express app into a modular route structure',
        description: 'Take a single-file Express.js server (500+ lines, provided) and refactor it into a clean modular structure: separate route files by domain (users, products, orders), extract middleware into its own directory, create a centralized error handler, and add request validation using Zod or Joi. Preserve all existing functionality. Deliver the refactored codebase with a folder structure diagram.',
      },
      {
        title: 'Write a Python data pipeline that cleans and normalizes a messy CSV',
        description: 'Build a Python script using pandas that takes a messy CSV (inconsistent date formats, mixed case names, duplicate rows, missing phone numbers) and outputs a clean version. Normalize dates to ISO 8601, title-case all names, deduplicate by email, format phone numbers to E.164, and flag rows with missing required fields. Include a summary report of changes made.',
      },
      {
        title: 'Create a rate limiter middleware for an Express.js API',
        description: 'Build a configurable rate limiting middleware for Express.js. Support: per-IP and per-API-key limits, sliding window algorithm, custom limits per route (e.g. /auth routes = 5/min, /api routes = 100/min), Redis-backed storage for multi-instance deployments, and proper 429 responses with Retry-After headers. Include the middleware, a Redis adapter, and usage examples.',
      },
      {
        title: 'Write a database migration script from MongoDB to PostgreSQL',
        description: 'Create a Node.js migration script that reads data from a MongoDB collection (users, with nested addresses and preferences), flattens it into a normalized PostgreSQL schema (users, addresses, preferences tables with foreign keys), handles data type conversions (ObjectId to UUID, dates, arrays to join tables), and logs progress with error recovery. Include the SQL schema, the migration script, and a verification query to compare record counts.',
      },
    ],
    tags: ['Python', 'Node.js', 'API', 'Automation', 'TypeScript', 'DevOps', 'Testing'],
  },
  {
    name: 'Research',
    weight: 7,
    guidance: 'Competitive analysis, market research, tool comparisons, pricing research, industry reports. Structured output with data tables.',
    examples: [
      {
        title: 'Compare 8 project management tools with a pricing and feature matrix',
        description: 'Research Asana, Monday, ClickUp, Linear, Notion, Jira, Basecamp, and Trello. For each tool: document pricing tiers, maximum team size per plan, number of integrations, API availability, and 3 key differentiators. Deliver a comparison table and a 1-paragraph recommendation for startups (<20 people), mid-market (20-200), and enterprise (200+).',
      },
      {
        title: 'Research API pricing for 5 AI providers and calculate monthly costs',
        description: 'Compare API pricing for OpenAI, Anthropic, Google Gemini, Mistral, and Cohere. Document model tiers, per-token pricing (input and output), rate limits, free tier quotas, and enterprise pricing if publicly available. Calculate cost for a workload of 1M input tokens + 500K output tokens per month for each provider. Deliver a comparison table with a recommendation.',
      },
      {
        title: 'Research and rank the top 10 AI code generation tools',
        description: 'Compile a ranked list of 10 AI code generation tools (GitHub Copilot, Cursor, Cody, Tabnine, etc). For each: list supported languages, IDE integrations, pricing, accuracy benchmarks where available, and privacy policy details. Rank by overall value for a 5-person engineering team. Deliver as a structured markdown report with a summary table.',
      },
      {
        title: 'Compile remote work productivity statistics for 2025-2026',
        description: 'Gather 15+ data points on remote work from reputable sources (McKinsey, Gallup, Buffer State of Remote Work, etc). Cover: productivity metrics, employee satisfaction rates, employer adoption trends, hybrid vs fully remote breakdown, and industry-specific differences. Present as a structured report with inline citations and a summary table.',
      },
      {
        title: 'Research 6 headless CMS platforms and recommend one for a startup blog',
        description: 'Evaluate Contentful, Strapi, Sanity, Payload CMS, Ghost, and Hygraph. Compare: pricing at different content volumes, developer experience (SDK quality, documentation), content modeling flexibility, self-hosted vs cloud options, and API performance. Deliver a comparison matrix and a 300-word recommendation for a 3-person startup shipping a developer blog.',
      },
      {
        title: 'Investigate open-source alternatives to 5 popular SaaS tools',
        description: 'For each of these tools: Intercom, Mixpanel, Notion, Calendly, and Mailchimp, identify the best open-source alternative. Compare: feature parity (what is missing vs the paid version), self-hosting requirements, community activity (GitHub stars, last commit date), and total cost of ownership for a 20-person team. Deliver a structured report with a go/no-go recommendation for each.',
      },
    ],
    tags: ['Market Research', 'Competitive Analysis', 'Tools', 'Statistics', 'AI'],
  },
  {
    name: 'Analysis',
    weight: 4,
    guidance: 'Data analysis, sentiment analysis, unit economics, SEO audits, financial modeling. Quantitative with structured output.',
    examples: [
      {
        title: 'Build a unit economics model for a subscription SaaS product',
        description: 'Create a detailed financial model for a B2B SaaS product at **$49/month**.\n\n**Include:**\n- CAC calculation broken down by channel (paid ads, content, outbound)\n- LTV with churn rate scenarios (2%, 5%, 10% monthly)\n- Payback period and gross margin\n- Break-even point analysis\n\nUse realistic industry benchmarks. Deliver with all formulas explained and key assumptions documented.',
      },
      {
        title: 'Audit 10 web pages for SEO issues and provide ranked fix recommendations',
        description: 'Analyze 10 URLs (provided) for SEO problems: missing or duplicate meta descriptions, broken heading hierarchy, low keyword density, missing alt tags, internal linking gaps, and mobile usability issues. For each page deliver: issues found, severity rating (critical/high/medium/low), and the specific fix. Rank all issues by impact.',
      },
      {
        title: 'Analyze app store reviews and generate a sentiment report',
        description: 'Take a dataset of 500 app store reviews (provided as CSV) and classify each as positive, negative, or neutral. Extract the top 10 recurring complaints and 5 most-praised features. Calculate overall sentiment score. Deliver: sentiment distribution breakdown, categorized issue list with frequency counts, and a 200-word executive summary.',
      },
      {
        title: 'Analyze website traffic data and identify the top 5 conversion bottlenecks',
        description: 'Given Google Analytics export data (CSV provided) for a SaaS marketing site, analyze the user funnel from landing page to signup. Identify the 5 pages with the highest drop-off rates, calculate conversion rates per step, compare mobile vs desktop performance, and flag any pages with unusually high bounce rates. Deliver a report with specific recommendations to improve each bottleneck.',
      },
      {
        title: 'Build a churn prediction framework for a subscription product',
        description: 'Design a churn prediction framework for a B2C subscription app. Define the 10 most predictive churn signals (login frequency, support tickets, feature usage, billing failures, etc), propose a scoring model with weights, and create a risk tier system (Low/Medium/High/Critical). For each tier, recommend 2-3 retention actions. Deliver as a structured document with example calculations.',
      },
    ],
    tags: ['Data Analysis', 'SEO', 'Financial Model', 'Audit', 'NLP'],
  },
  {
    name: 'Content',
    weight: 7,
    guidance: 'API documentation, technical blog posts, email sequences, SEO copy, product descriptions. Professional, specific, with clear deliverable format.',
    examples: [
      {
        title: 'Write API documentation for 5 REST endpoints',
        description: 'Document 5 REST API endpoints (specs will be provided).\n\n**For each endpoint include:**\n- URL pattern and HTTP method\n- Required headers and auth\n- Request body schema with **TypeScript types**\n- Response schema with example JSON\n- Possible error codes with descriptions\n- Example `curl` request\n\nFollow OpenAPI-style conventions. Deliver in clean markdown.',
      },
      {
        title: 'Generate SEO meta descriptions for 20 product pages',
        description: 'Write 20 unique meta descriptions (150-160 characters each) for an e-commerce site. Product names and categories will be provided. Each description must include the primary keyword, a clear value proposition, and a call-to-action. No two descriptions should share the same phrasing pattern. Deliver in a table: page title | URL slug | meta description.',
      },
      {
        title: 'Write a 3-email onboarding sequence for a developer API platform',
        description: 'Create a 3-email welcome sequence. Email 1 (Day 0): Welcome message with API key setup guide and a link to quickstart docs. Email 2 (Day 3): First API call tutorial with code snippets in Python and JavaScript. Email 3 (Day 7): Advanced features overview and link to community. Each email under 200 words. Include subject lines with A/B test variants for each.',
      },
      {
        title: 'Write a technical blog post comparing WebSockets vs SSE',
        description: 'Write a 1000-word blog post comparing WebSockets and Server-Sent Events for real-time web features. Cover: protocol mechanics, browser compatibility, use cases (chat vs live feeds vs notifications), scaling considerations (connection limits, load balancing), and implementation examples in JavaScript for both. Include clear section headings, a comparison table, and a "when to use which" conclusion.',
      },
      {
        title: 'Write a developer changelog for 3 months of product updates',
        description: 'Given a list of 25 shipped features and bug fixes (provided), write a polished developer-facing changelog grouped by month. For each entry: write a clear title, a 1-2 sentence description of what changed and why it matters, and tag it (Feature, Improvement, Bugfix, Breaking Change). Include migration notes for any breaking changes. Format in markdown, ready to publish.',
      },
      {
        title: 'Create a knowledge base with 10 help articles for a SaaS product',
        description: 'Write 10 help center articles for a project management SaaS tool. Topics: getting started, creating a project, inviting team members, setting permissions, using Kanban boards, tracking time, generating reports, integrations setup, billing FAQ, and account deletion. Each article: 200-400 words, step-by-step format with numbered instructions, and a "Related Articles" section at the bottom.',
      },
    ],
    tags: ['Technical Writing', 'Documentation', 'SEO', 'Copywriting', 'Email'],
  },
  {
    name: 'Social',
    weight: 4,
    guidance: 'Content calendars, Twitter/X threads, LinkedIn posts, community copy. Platform-specific, with actual draft copy.',
    examples: [
      {
        title: 'Create a 2-week social media content calendar for a developer tool launch',
        description: 'Build a 14-day content calendar for Twitter/X and LinkedIn for a new developer API product launch. For each day: post copy (ready to publish), content type (thread, single post, poll, or carousel), hashtags, and posting time. Mix: 40% educational, 30% product features, 20% engagement (polls, questions), 10% behind-the-scenes. Include at least 3 Twitter threads with full content.',
      },
      {
        title: 'Write 10 Twitter/X thread hooks for a startup founder',
        description: 'Create 10 opening tweets for Twitter/X threads on business topics: scaling to 1K users, early hiring mistakes, choosing a tech stack, pricing strategy, and cold outreach tactics. Each hook must be under 280 characters and create strong curiosity to read more. For each hook, include a 3-5 bullet suggested thread outline.',
      },
      {
        title: 'Write LinkedIn post series for a B2B SaaS product launch',
        description: 'Create 5 LinkedIn posts for a B2B SaaS launch campaign. Post 1: founder story (problem discovery). Post 2: behind-the-scenes build process. Post 3: early customer testimonial format. Post 4: product demo walkthrough (text-based). Post 5: launch day announcement with CTA. Each post: 150-250 words, include emoji usage, hashtag suggestions, and optimal posting day/time.',
      },
    ],
    tags: ['Social Media', 'Content Calendar', 'Twitter', 'LinkedIn'],
  },
  {
    name: 'Design',
    weight: 4,
    guidance: 'Design system specs, UX copy, style guides, checkout flows. Written deliverables (not visual).',
    examples: [
      {
        title: 'Create a design system spec with color palette, typography, spacing, and component tokens',
        description: 'Define a complete design system for a SaaS analytics dashboard. Include: color palette (primary, secondary, accent, semantic colors with hex values and usage rules), typography scale using a Google Fonts pairing, spacing system on a 4px grid, border radius tokens, shadow tokens, and component specs for buttons (primary, secondary, ghost, danger with all states), input fields (default, focus, error, disabled), and cards.',
      },
      {
        title: 'Write UX copy for a complete 4-step e-commerce checkout flow',
        description: 'Write all microcopy for a checkout: Cart Review, Shipping Info, Payment, and Confirmation. Include: page headings, field labels, placeholder text, helper text, 15+ validation error messages (covering empty fields, invalid formats, expired cards), button labels for each step, progress indicator copy, success and failure page copy, and order confirmation email subject + body. Tone: clear, trustworthy, minimal.',
      },
      {
        title: 'Design an error state system for a web application',
        description: 'Create a comprehensive error state guide for a SaaS dashboard. Cover: empty states (no data yet), loading failures (API timeout, network error), permission denied screens, 404 pages, form validation error patterns, toast notification copy for 10 common actions (save, delete, invite, export), and a maintenance mode page. For each state: write the heading, body copy, and primary action button text. Include illustration suggestions.',
      },
    ],
    tags: ['Design System', 'UX Writing', 'UI', 'E-commerce'],
  },
  {
    name: 'Security',
    weight: 4,
    guidance: 'Code security audits, vulnerability assessments, dependency reviews. Structured report with severity ratings.',
    examples: [
      {
        title: 'Review a Node.js API for security vulnerabilities',
        description: 'Audit the provided Node.js/Express API code for security issues.\n\n**Check for:**\n- NoSQL injection and XSS in responses\n- CSRF vulnerabilities\n- Insecure dependencies (via `npm audit`)\n- Hardcoded secrets and missing rate limiting\n- JWT misconfiguration (weak signing, no expiry)\n- CORS misconfiguration\n\nDeliver a **vulnerability report** with: issue description, severity (Critical/High/Medium/Low), affected code location, and recommended fix for each.',
      },
      {
        title: 'Audit npm dependencies for known CVEs and recommend alternatives',
        description: 'Run a full dependency audit on a Node.js project (package.json provided). Identify all direct and transitive dependencies with known CVEs. For each vulnerability: list the CVE ID, severity score, affected package and version, and whether a patched version exists. Recommend a drop-in replacement for any package that is unmaintained or has unpatched critical issues. Deliver as a structured table.',
      },
      {
        title: 'Create a security checklist for deploying a Node.js app to production',
        description: 'Write a comprehensive pre-deployment security checklist for a Node.js/Express application. Cover: environment variable management (no hardcoded secrets), HTTPS enforcement, CORS policy, rate limiting configuration, input sanitization, SQL/NoSQL injection prevention, authentication token best practices, dependency scanning, logging sensitive data (what NOT to log), and server hardening. Deliver as a markdown checklist with pass/fail criteria for each item.',
      },
    ],
    tags: ['Security Audit', 'Node.js', 'Vulnerability'],
  },
  {
    name: 'Other',
    weight: 5,
    guidance: 'Business planning, SWOT analysis, RFCs, technical architecture docs, process documents.',
    examples: [
      {
        title: 'Create a SWOT analysis for entering the EdTech market',
        description: 'Build a detailed SWOT analysis for a startup launching an AI tutoring product in the EdTech market. Include 5+ items per quadrant with 1-2 sentence explanations. Add a competitive positioning section identifying 3 direct competitors and their weak points. Deliver: the SWOT matrix, a risk mitigation plan for top 3 threats, and 3 recommended go-to-market actions.',
      },
      {
        title: 'Write a technical RFC for adding real-time notifications',
        description: 'Draft an RFC for adding real-time notifications to a web application. Cover: problem statement with user impact data, proposed solution comparing WebSocket vs SSE vs polling (with pros/cons table), system architecture (text-based diagram), database schema changes, API contract for subscribe/unsubscribe, migration plan with rollback steps, performance estimates (connections per server, message latency), and security considerations for auth on persistent connections.',
      },
      {
        title: 'Create a go-to-market plan for a developer tool',
        description: 'Build a 90-day GTM plan for a developer-focused API product. Cover: target persona definition (who is buying and who is using), pricing strategy (freemium vs trial vs usage-based with pros/cons), launch channels ranked by expected ROI (Product Hunt, Hacker News, Dev.to, Twitter, etc), content marketing plan (4 blog post topics + 2 tutorial ideas), and success metrics with targets for each phase (Week 1, Month 1, Month 3).',
      },
      {
        title: 'Write a post-mortem template and fill it out for a sample outage',
        description: 'Create a reusable post-mortem template for engineering teams, then fill it out with a realistic example (e.g., a database connection pool exhaustion causing 30 minutes of downtime). Include: incident summary, timeline of events (minute by minute), root cause analysis (5 Whys), impact assessment (users affected, revenue lost), what went well, what went wrong, and 5 action items with owners and due dates.',
      },
    ],
    tags: ['Strategy', 'Architecture', 'RFC', 'Business Analysis'],
  },
];

/**
 * Pick a category using weighted random selection.
 */
function pickCategory(): typeof CATEGORIES[number] {
  const total = CATEGORIES.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const cat of CATEGORIES) {
    roll -= cat.weight;
    if (roll <= 0) return cat;
  }
  return CATEGORIES[0];
}

/**
 * Generate a unique task using Gemini, given a category and recent titles to avoid.
 */
async function generateUniqueTask(
  category: typeof CATEGORIES[number],
  recentTitles: string[]
): Promise<{ title: string; description: string; tags: string[]; resolvedCategory: string }> {
  // Try Gemini first for a truly unique task
  try {
    const avoidList = recentTitles.length > 0
      ? `\n\nDO NOT use any of these titles or close variations — they were recently posted:\n${recentTitles.map(t => `- ${t}`).join('\n')}`
      : '';

    const prompt = `Generate a single task for a freelance marketplace where clients hire autonomous AI agents to do real work.

CATEGORY: ${category.name}
GUIDANCE: ${category.guidance}

EXAMPLE TASKS IN THIS CATEGORY (for style reference only — generate something DIFFERENT):
${category.examples.map(e => `- ${e.title}`).join('\n')}
${avoidList}

CRITICAL DISTINCTION — AI AGENT vs CHATBOT:
These tasks are for AI AGENTS, not chatbots. An AI agent can:
- Write, test, and debug multi-file codebases
- Process datasets, scrape live data, generate structured output files
- Build complete automation pipelines with error handling
- Produce production-ready artifacts (scripts, configs, documentation sets)
- Execute multi-step workflows that require planning and iteration

DO NOT generate tasks like:
- "Explain the difference between X and Y" (ChatGPT can do this)
- "Summarize this article" (trivial for any LLM)
- "Write a paragraph about..." (no structured output needed)
- Generic advice or opinion tasks
- Tasks with no concrete, verifiable deliverable

RULES:
- The task MUST be related to the ${category.name} category. Do NOT generate a task for a different category.
- The task must require MULTI-STEP work with a concrete, structured deliverable
- It should involve building something, processing data, creating a system, or producing a structured artifact
- Title: concise, action-oriented, under 80 characters
- Description: Use markdown formatting. Start with 1-2 sentences of context, then a bullet list of specific deliverables. Use **bold** for key terms. A reader should know exactly what work is expected and what to deliver.
- Tags: 2-4 relevant tags
- Be specific and realistic as useful seed work for an active marketplace
- Do NOT invent a named outside company, customer, or private dataset
- Do NOT mention AI, agents, or Hive in the task itself

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no code fences):
{"title": "...", "description": "...", "tags": ["...", "..."]}`;

    const response = await generateWithGemini(
      'You generate useful freelance task listings for a clearly system-seeded marketplace queue. Be specific, practical, and transparent. No filler.',
      prompt
    );

    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);
    return {
      title: (parsed.title || '').trim().slice(0, 120),
      description: (parsed.description || '').trim().slice(0, 1000),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : category.tags.slice(0, 3),
      resolvedCategory: category.name,
    };
  } catch (err: any) {
    console.warn(`[AUTO-POST] Gemini unavailable (${err.message}), using fallback`);
  }

  // Fallback: pick a random example from the SAME category first
  const recentLower = new Set(recentTitles.map(t => t.toLowerCase()));

  // Try same-category examples first
  const sameCategory = category.examples
    .filter(e => !recentLower.has(e.title.toLowerCase()))
    .map(e => ({ title: e.title, description: e.description, tags: category.tags }));

  if (sameCategory.length > 0) {
    const pick = sameCategory[Math.floor(Math.random() * sameCategory.length)];
    return {
      title: pick.title,
      description: pick.description,
      tags: pick.tags.slice(0, 3),
      resolvedCategory: category.name,
    };
  }

  // All same-category examples were recently used — pick from any category, but use THAT example's category
  const allExamples = CATEGORIES.flatMap(c =>
    c.examples.map(e => ({ title: e.title, description: e.description, category: c.name, tags: c.tags }))
  );
  const unused = allExamples.filter(e => !recentLower.has(e.title.toLowerCase()));
  const pool = unused.length > 0 ? unused : allExamples;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  return {
    title: pick.title,
    description: pick.description,
    tags: pick.tags.slice(0, 3),
    resolvedCategory: pick.category,
  };
}

/**
 * Generate appropriate deliverable specs based on task category.
 * This tells agents what format to deliver in (code, structured text, etc.)
 */
function getDeliverableSpecs(category: string): Array<{ type: string; label: string; description: string; required: boolean }> {
  switch (category) {
    case 'Development':
      return [
        { type: 'code', label: 'Source Code', description: 'Complete, runnable source code with inline comments', required: true },
        { type: 'text', label: 'Documentation', description: 'Setup instructions, dependencies, and usage guide', required: true },
      ];
    case 'Research':
      return [
        { type: 'text', label: 'Research Report', description: 'Structured report with findings, comparison tables, data, and citations', required: true },
      ];
    case 'Analysis':
      return [
        { type: 'text', label: 'Analysis Report', description: 'Data-driven analysis with methodology, findings, tables, and recommendations', required: true },
        { type: 'code', label: 'Data / Formulas', description: 'Supporting calculations, scripts, or raw data', required: false },
      ];
    case 'Content':
      return [
        { type: 'text', label: 'Content Deliverable', description: 'Final polished copy with proper formatting, ready to publish', required: true },
      ];
    case 'Social':
      return [
        { type: 'text', label: 'Content Calendar / Posts', description: 'Ready-to-publish posts with platform-specific formatting and schedule', required: true },
      ];
    case 'Design':
      return [
        { type: 'text', label: 'Design Specification', description: 'Complete spec with tokens, color values, typography, and component definitions', required: true },
        { type: 'code', label: 'Design Tokens', description: 'Design tokens as CSS custom properties or JSON', required: false },
      ];
    case 'Security':
      return [
        { type: 'text', label: 'Security Report', description: 'Vulnerability report with severity ratings (Critical/High/Medium/Low) and remediation steps', required: true },
        { type: 'code', label: 'Fix Patches', description: 'Code patches or configuration fixes for identified vulnerabilities', required: false },
      ];
    default:
      return [
        { type: 'text', label: 'Deliverable', description: 'Complete work product with structured formatting', required: true },
      ];
  }
}

export interface AutoPostResult {
  tasksCreated: number;
  taskIds: string[];
  agentBids: string[];
  errors: string[];
}

export async function autoPostTasks(): Promise<AutoPostResult> {
  const db = await getDb();
  const result: AutoPostResult = { tasksCreated: 0, taskIds: [], agentBids: [], errors: [] };

  const tasksPerRun = getIntEnv('AUTO_POST_TASKS_PER_RUN', 2, 1, 4);
  const postWindowHours = getIntEnv('AUTO_POST_WINDOW_HOURS', 24, 1, 168);
  const maxTasksPerWindow = getIntEnv('AUTO_POST_MAX_PER_WINDOW', 6, 1, 12);
  const windowStart = new Date(Date.now() - postWindowHours * 60 * 60 * 1000);

  // Guard: keep scheduled activity steady without flooding the marketplace.
  const autoPostedRecently = await db
    .collection(COLLECTIONS.TASKS)
    .countDocuments({
      createdAt: { $gte: windowStart },
      $or: [
        { systemGenerated: true },
        { creationSurface: 'scheduled-seed' },
        { activitySource: SCHEDULED_TASK_SOURCE },
        { clientAddress: { $regex: /^did:privy:cl_/ } },
      ],
    });

  const remainingWindowCapacity = Math.max(0, maxTasksPerWindow - autoPostedRecently);
  const tasksToCreate = Math.min(tasksPerRun, remainingWindowCapacity);

  if (tasksToCreate === 0) {
    console.log(`[AUTO-POST] Already posted ${autoPostedRecently} scheduled task(s) in the last ${postWindowHours}h, skipping`);
    return result;
  }

  // Fetch recent task titles to avoid duplicates
  const recentTasks = await db
    .collection(COLLECTIONS.TASKS)
    .find({})
    .sort({ createdAt: -1 })
    .limit(30)
    .project({ title: 1 })
    .toArray();
  const recentTitles = recentTasks.map(t => t.title).filter(Boolean);

  for (let i = 0; i < tasksToCreate; i++) {
    // Pick a category and generate a unique task
    const category = pickCategory();

    try {
      const generated = await generateUniqueTask(category, recentTitles);

      if (!generated.title) {
        result.errors.push('Generated task had empty title');
        continue;
      }

      recentTitles.push(generated.title);
      const client = SYSTEM_CLIENT_POOL[Math.floor(Math.random() * SYSTEM_CLIENT_POOL.length)];

      // Budget weighted toward $1: 50% -> $1, 15% -> $0.50, 35% -> $1-$3
      const roll = Math.random();
      let budgetAmount: number;
      if (roll < 0.50) {
        budgetAmount = 1;
      } else if (roll < 0.65) {
        budgetAmount = 0.5;
      } else {
        budgetAmount = 1 + Math.floor(Math.random() * 3);
      }
      const budget = `$${budgetAmount} USDC`;

      // Direct Routing: instant match to best agent
      const matches = await rankAgentsForTask(
        db,
        {
          title: generated.title,
          description: generated.description,
          category: generated.resolvedCategory,
          requirements: '',
          tags: generated.tags,
          budget,
          budgetAmount,
        },
        { limit: 5 }
      );

      const bestMatch = matches.length > 0 ? matches[0] : null;
      const now = new Date();

      const task = {
        title: generated.title,
        description: generated.description,
        category: generated.resolvedCategory,
        tags: generated.tags,
        requirements: '',
        budget,
        budgetAmount,
        status: bestMatch ? 'In Progress' : 'Open',
        clientAddress: client.address,
        clientName: client.name,
        assignedAgent: bestMatch?.agentId || null,
        assignedAgentId: bestMatch?.agentId || null,
        assignedAgentName: bestMatch?.agent?.name || null,
        proposalsCount: bestMatch ? 1 : 0,
        tokenConfig: null,
        deliverableSpecs: getDeliverableSpecs(generated.resolvedCategory),
        instantMatch: !!bestMatch,
        matchScore: bestMatch?.score || null,
        matchConfidence: bestMatch?.confidence || null,
        systemGenerated: true,
        activitySource: SCHEDULED_TASK_SOURCE,
        creationSurface: 'scheduled-seed',
        humanVerified: false,
        createdAt: now,
        updatedAt: now,
      };

      const insertResult = await db.collection(COLLECTIONS.TASKS).insertOne(task);
      const taskId = insertResult.insertedId.toString();
      result.taskIds.push(taskId);

      // Create auto-accepted routing record if matched
      if (bestMatch) {
        const bid = {
          taskId,
          agentId: bestMatch.agentId,
          agentName: bestMatch.agent.name,
          agentAddress: bestMatch.agent.solanaAddress || null,
          amount: budget,
          timeEstimate: '2-4 days',
          coverLetter: `Matched automatically by Hive with ${bestMatch.confidence} confidence (${bestMatch.score}/100). ${bestMatch.reasons.join(' ')}`,
          status: 'accepted',
          autoMatched: true,
          matchScore: bestMatch.score,
          matchReasons: bestMatch.reasons,
          systemGenerated: true,
          activitySource: SCHEDULED_TASK_SOURCE,
          createdAt: now,
          updatedAt: now,
        };

        await db.collection(COLLECTIONS.BIDS).insertOne(bid);
        result.agentBids.push(`${bestMatch.agent.name} (${bestMatch.score}/100)`);

        // Log match activity
        await db.collection(COLLECTIONS.ACTIVITY).insertOne({
          type: 'BidAccepted',
          taskId: insertResult.insertedId,
          actorName: bestMatch.agent.name,
          metadata: {
            taskTitle: generated.title,
            agentName: bestMatch.agent.name,
            agentId: bestMatch.agentId,
            autoMatched: true,
            systemGenerated: true,
            source: SCHEDULED_TASK_SOURCE,
          },
          createdAt: now,
        });
      }

      // Log task creation activity
      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'TaskCreated',
        taskId: insertResult.insertedId,
        actorAddress: client.address,
        actorName: client.name,
        metadata: {
          title: generated.title,
          category: generated.resolvedCategory,
          budget,
          instantMatch: !!bestMatch,
          systemGenerated: true,
          source: SCHEDULED_TASK_SOURCE,
        },
        createdAt: now,
      });

      result.tasksCreated++;
      const matchInfo = bestMatch ? ` -> instant matched to ${bestMatch.agent.name} (${bestMatch.score}/100)` : ' (no match, posted as Open)';
      console.log(`[AUTO-POST] Created "${generated.title}" [${generated.resolvedCategory}] by ${client.name} ($${budgetAmount} USDC)${matchInfo}`);
    } catch (error: any) {
      result.errors.push(`Task generation error: ${error.message}`);
      console.error(`[AUTO-POST] Error:`, error.message);
    }
  }

  return result;
}
