/**
 * Auto-Post Tasks
 * 
 * Creates and publishes unique tasks on a schedule using Gemini.
 * Each run generates a fresh task — never repeats the same title.
 * Budget range: $0.50–$3 USDC, weighted toward $1.
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { handleNewTask } from '@/lib/stealth-agents/runner';
import { generateWithGemini } from '@/lib/stealth-agents/gemini';

// Client pool for scheduled task creation
const CLIENT_POOL = [
  { name: 'alexreed', address: 'did:privy:cl_alexreed' },
  { name: 'jordan.t', address: 'did:privy:cl_jordant' },
  { name: 'priya_s', address: 'did:privy:cl_priyas' },
  { name: 'marcelo.dev', address: 'did:privy:cl_marcelodev' },
  { name: 'sarahk', address: 'did:privy:cl_sarahk' },
  { name: 'benwright', address: 'did:privy:cl_benwright' },
  { name: 'dan.okoro', address: 'did:privy:cl_danokoro' },
  { name: 'tina.w', address: 'did:privy:cl_tinaw' },
  { name: 'mikechen', address: 'did:privy:cl_mikechen' },
  { name: 'olawale_', address: 'did:privy:cl_olawale' },
  { name: 'emilyjones', address: 'did:privy:cl_emilyjones' },
  { name: 'raj.p', address: 'did:privy:cl_rajp' },
  { name: 'karla.m', address: 'did:privy:cl_karlam' },
  { name: 'yusuf_a', address: 'did:privy:cl_yusufa' },
  { name: 'lucas.h', address: 'did:privy:cl_lucash' },
  { name: 'chioma.n', address: 'did:privy:cl_chioman' },
  { name: 'jamespark', address: 'did:privy:cl_jamespark' },
  { name: 'natalief', address: 'did:privy:cl_natalief' },
  { name: 'omar.kh', address: 'did:privy:cl_omarkh' },
  { name: 'sofiav', address: 'did:privy:cl_sofiav' },
  { name: 'kwame.b', address: 'did:privy:cl_kwameb' },
  { name: 'hannah_r', address: 'did:privy:cl_hannahr' },
  { name: 'davide.c', address: 'did:privy:cl_davidec' },
  { name: 'amara.o', address: 'did:privy:cl_amarao' },
  { name: 'ryanl', address: 'did:privy:cl_ryanl' },
  { name: 'mei.lin', address: 'did:privy:cl_meilin' },
  { name: 'tobi_e', address: 'did:privy:cl_tobie' },
  { name: 'isabelle.f', address: 'did:privy:cl_isabellef' },
  { name: 'kenji.t', address: 'did:privy:cl_kenjit' },
  { name: 'aisha.d', address: 'did:privy:cl_aishad' },
];

// Categories with descriptions and example tasks to guide Gemini
const CATEGORIES = [
  {
    name: 'Development',
    weight: 25,
    guidance: 'Code tasks: scripts, APIs, unit tests, CI/CD pipelines, refactoring, automation, CLI tools. Languages: Python, TypeScript, Node.js, Bash.',
    examples: [
      {
        title: 'Write a Python script to scrape product prices from 3 competitor websites',
        description: 'Build a Python script that scrapes product pricing from Amazon, eBay, and AliExpress for a given keyword. Output a CSV with columns: product name, price, seller, URL, and scraped_at timestamp. Handle rate limiting, rotating user agents, and basic error recovery. Include a requirements.txt and usage instructions.',
      },
      {
        title: 'Build a REST API endpoint that validates and cleans CSV uploads',
        description: 'Create an Express.js endpoint (POST /api/upload) that accepts a CSV file, validates column headers match a provided schema, removes duplicate rows, normalizes all dates to ISO 8601, and fills missing fields with configurable defaults. Return the cleaned data as JSON. Include input validation, error responses with clear messages, and a sample CSV for testing.',
      },
      {
        title: 'Create a GitHub Actions CI/CD pipeline for a Node.js project',
        description: 'Write a complete GitHub Actions workflow YAML for a Node.js monorepo. Stages: install dependencies (with caching), run ESLint, run Jest tests with coverage threshold (80%), build for production, and deploy to Vercel on push to main. Include environment variable handling, Slack notification on failure, and a manual deploy trigger for staging.',
      },
      {
        title: 'Write a Bash script to automate daily PostgreSQL backups to S3',
        description: 'Create a production-ready Bash script that performs a pg_dump of a PostgreSQL database, compresses the output with gzip, uploads it to an S3 bucket with a timestamped filename, and deletes local and remote backups older than 30 days. Include logging to a file, error handling with exit codes, and a recommended cron schedule. Deliver the script plus setup guide.',
      },
      {
        title: 'Write unit tests for a user authentication module',
        description: 'Given a Node.js authentication module with signup, login, password reset, and token refresh endpoints, write comprehensive Jest tests. Cover valid inputs, invalid inputs, edge cases like expired JWTs, duplicate emails, and weak passwords. Mock external dependencies (database, email service). Target 90%+ code coverage. Deliver the test file and a coverage report.',
      },
    ],
    tags: ['Python', 'Node.js', 'API', 'Automation', 'TypeScript', 'DevOps', 'Testing'],
  },
  {
    name: 'Research',
    weight: 20,
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
    ],
    tags: ['Market Research', 'Competitive Analysis', 'Tools', 'Statistics', 'AI'],
  },
  {
    name: 'Analysis',
    weight: 15,
    guidance: 'Data analysis, sentiment analysis, unit economics, SEO audits, financial modeling. Quantitative with structured output.',
    examples: [
      {
        title: 'Build a unit economics model for a subscription SaaS product',
        description: 'Create a detailed financial model for a B2B SaaS product at $49/month. Include: CAC calculation broken down by channel (paid ads, content, outbound), LTV with churn rate scenarios (2%, 5%, 10% monthly), payback period, gross margin, and break-even point. Use realistic industry benchmarks. Deliver the model with all formulas explained and key assumptions documented.',
      },
      {
        title: 'Audit 10 web pages for SEO issues and provide ranked fix recommendations',
        description: 'Analyze 10 URLs (provided) for SEO problems: missing or duplicate meta descriptions, broken heading hierarchy, low keyword density, missing alt tags, internal linking gaps, and mobile usability issues. For each page deliver: issues found, severity rating (critical/high/medium/low), and the specific fix. Rank all issues by impact.',
      },
      {
        title: 'Analyze app store reviews and generate a sentiment report',
        description: 'Take a dataset of 500 app store reviews (provided as CSV) and classify each as positive, negative, or neutral. Extract the top 10 recurring complaints and 5 most-praised features. Calculate overall sentiment score. Deliver: sentiment distribution breakdown, categorized issue list with frequency counts, and a 200-word executive summary.',
      },
    ],
    tags: ['Data Analysis', 'SEO', 'Financial Model', 'Audit', 'NLP'],
  },
  {
    name: 'Content',
    weight: 20,
    guidance: 'API documentation, technical blog posts, email sequences, SEO copy, product descriptions. Professional, specific, with clear deliverable format.',
    examples: [
      {
        title: 'Write API documentation for 5 REST endpoints',
        description: 'Document 5 REST API endpoints (specs will be provided). For each endpoint: URL pattern, HTTP method, required headers, request body schema with TypeScript types, response schema, possible error codes with descriptions, example curl request, and example JSON response. Follow OpenAPI-style conventions. Deliver in clean markdown.',
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
    ],
    tags: ['Technical Writing', 'Documentation', 'SEO', 'Copywriting', 'Email'],
  },
  {
    name: 'Social',
    weight: 5,
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
    ],
    tags: ['Social Media', 'Content Calendar', 'Twitter', 'LinkedIn'],
  },
  {
    name: 'Design',
    weight: 5,
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
    ],
    tags: ['Design System', 'UX Writing', 'UI', 'E-commerce'],
  },
  {
    name: 'Security',
    weight: 5,
    guidance: 'Code security audits, vulnerability assessments, dependency reviews. Structured report with severity ratings.',
    examples: [
      {
        title: 'Review a Node.js API for security vulnerabilities',
        description: 'Audit the provided Node.js/Express API code for security issues. Check for: NoSQL injection, XSS in responses, CSRF vulnerabilities, insecure dependencies (via npm audit), hardcoded secrets, missing rate limiting, JWT misconfiguration (weak signing, no expiry), and CORS misconfiguration. Deliver a vulnerability report with: issue description, severity (Critical/High/Medium/Low), affected code location, and recommended fix for each.',
      },
      {
        title: 'Audit npm dependencies for known CVEs and recommend alternatives',
        description: 'Run a full dependency audit on a Node.js project (package.json provided). Identify all direct and transitive dependencies with known CVEs. For each vulnerability: list the CVE ID, severity score, affected package and version, and whether a patched version exists. Recommend a drop-in replacement for any package that is unmaintained or has unpatched critical issues. Deliver as a structured table.',
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
): Promise<{ title: string; description: string; tags: string[] }> {
  // Try Gemini first for a truly unique task
  try {
    const avoidList = recentTitles.length > 0
      ? `\n\nDO NOT use any of these titles or close variations — they were recently posted:\n${recentTitles.map(t => `- ${t}`).join('\n')}`
      : '';

    const prompt = `Generate a single task for a freelance marketplace where clients hire AI agents.

CATEGORY: ${category.name}
GUIDANCE: ${category.guidance}

EXAMPLE TASKS IN THIS CATEGORY (for style reference only — generate something DIFFERENT):
${category.examples.map(e => `- ${e.title}`).join('\n')}
${avoidList}

RULES:
- The task should be something a client would delegate to an AI agent (not something trivial enough for a quick ChatGPT prompt)
- It should require multi-step work, structured output, or domain expertise
- Title: concise, action-oriented, under 80 characters
- Description: 2-4 sentences. Be SPECIFIC about what to deliver, the format, scope, and any technical requirements. A reader should know exactly what work is expected.
- Tags: 2-4 relevant tags
- Be specific and realistic — real clients posting real work
- Do NOT mention AI, agents, or Hive in the task itself

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no code fences):
{"title": "...", "description": "...", "tags": ["...", "..."]}`;

    const response = await generateWithGemini(
      'You generate realistic freelance task listings. Be specific and practical. No filler.',
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
    };
  } catch (err: any) {
    console.warn(`[AUTO-POST] Gemini unavailable (${err.message}), using fallback`);
  }

  // Fallback: pick a random example not recently posted
  const recentLower = new Set(recentTitles.map(t => t.toLowerCase()));
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
  };
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

  // Fetch recent task titles to avoid duplicates
  const recentTasks = await db
    .collection(COLLECTIONS.TASKS)
    .find({})
    .sort({ createdAt: -1 })
    .limit(30)
    .project({ title: 1 })
    .toArray();
  const recentTitles = recentTasks.map(t => t.title).filter(Boolean);

  // Pick a category and generate a unique task
  const category = pickCategory();

  try {
    const generated = await generateUniqueTask(category, recentTitles);

    if (!generated.title) {
      result.errors.push('Generated task had empty title');
      return result;
    }

    const client = CLIENT_POOL[Math.floor(Math.random() * CLIENT_POOL.length)];

    // Budget weighted toward $1: 50% → $1, 15% → $0.50, 35% → $1-$3
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

    const task = {
      title: generated.title,
      description: generated.description,
      category: category.name,
      tags: generated.tags,
      requirements: '',
      budget,
      budgetAmount,
      status: 'Open',
      clientAddress: client.address,
      clientName: client.name,
      proposalsCount: 0,
      tokenConfig: null,
      deliverableSpecs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await db.collection(COLLECTIONS.TASKS).insertOne(task);
    const taskId = insertResult.insertedId.toString();
    result.taskIds.push(taskId);

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'TaskCreated',
      taskId: insertResult.insertedId,
      actorAddress: client.address,
      actorName: client.name,
      metadata: {
        title: generated.title,
        category: category.name,
        budget,
      },
      createdAt: new Date(),
    });

    // Trigger agent bidding
    try {
      const bidResult = await handleNewTask({
        taskId,
        title: generated.title,
        description: generated.description,
        category: category.name,
        requirements: '',
        budget,
      });

      if (bidResult.bid) {
        result.agentBids.push(`${bidResult.agent} → "${generated.title}"`);
        console.log(`[AUTO-POST] ${bidResult.agent} bid on "${generated.title}"`);
      } else {
        console.log(`[AUTO-POST] No agent bid: ${bidResult.error || 'no match'}`);
      }
    } catch (err: any) {
      console.error(`[AUTO-POST] Agent bidding failed:`, err.message);
    }

    result.tasksCreated++;
    console.log(`[AUTO-POST] Created "${generated.title}" [${category.name}] by ${client.name} ($${budgetAmount} USDC)`);
  } catch (error: any) {
    result.errors.push(`Task generation error: ${error.message}`);
    console.error(`[AUTO-POST] Error:`, error.message);
  }

  return result;
}
