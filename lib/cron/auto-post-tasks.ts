/**
 * Auto-Post Tasks
 * 
 * Creates and publishes tasks on a schedule.
 * Budget range: $0.50–$3 USDC, weighted toward $1.
 * Tasks are designed to require AI agent capabilities.
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { handleNewTask } from '@/lib/stealth-agents/runner';

// Client pool for scheduled task creation
const CLIENT_POOL = [
  { name: 'Alex_R', address: 'did:privy:cl_alex_r' },
  { name: 'CryptoSam', address: 'did:privy:cl_cryptosam' },
  { name: 'devJordan', address: 'did:privy:cl_devjordan' },
  { name: 'Maria_K', address: 'did:privy:cl_maria_k' },
  { name: 'StartupBen', address: 'did:privy:cl_ben' },
  { name: 'SarahLee', address: 'did:privy:cl_steph' },
  { name: 'web3_dan', address: 'did:privy:cl_web3dan' },
  { name: 'TinaWorks', address: 'did:privy:cl_tokentina' },
  { name: 'MikeOps', address: 'did:privy:cl_defimike' },
  { name: 'SarahDesign', address: 'did:privy:cl_nftsarah' },
  { name: 'CodeMonkey42', address: 'did:privy:cl_cm42' },
  { name: 'LisaMarketing', address: 'did:privy:cl_chainlisa' },
];

// Tasks that genuinely require AI agent delegation
// These are things you'd hire an agent for rather than doing in ChatGPT
const TASK_TEMPLATES: Array<{
  category: string;
  tasks: Array<{ title: string; description: string; tags: string[] }>;
}> = [
  {
    category: 'Development',
    tasks: [
      {
        title: 'Write a Python script to scrape and compare product prices',
        description: 'Build a Python script that scrapes product pricing from 3 e-commerce sites (Amazon, eBay, AliExpress) for a given product keyword. Output a CSV with columns: product name, price, seller, URL, scraped_at. Handle rate limiting and include error handling. Deliver the script + sample output.',
        tags: ['Python', 'Web Scraping', 'Automation'],
      },
      {
        title: 'Build a REST API endpoint that validates and cleans CSV uploads',
        description: 'Create an Express.js endpoint (POST /api/upload) that accepts a CSV file upload, validates column headers against a schema, removes duplicate rows, normalizes date formats to ISO 8601, fills missing values with defaults, and returns cleaned JSON. Include input validation and error responses.',
        tags: ['Node.js', 'API', 'Data Cleaning'],
      },
      {
        title: 'Write unit tests for a user authentication module',
        description: 'Given a Node.js authentication module with signup, login, password reset, and JWT token refresh functions, write comprehensive unit tests using Jest. Cover: valid inputs, invalid inputs, edge cases (expired tokens, duplicate emails, weak passwords), and mock external dependencies. Target 90%+ coverage.',
        tags: ['Testing', 'Jest', 'Authentication'],
      },
      {
        title: 'Create a GitHub Actions CI/CD pipeline for a Node.js app',
        description: 'Write a complete GitHub Actions workflow (.yml) for a Node.js project. Include: lint (ESLint), test (Jest), build, and deploy to Vercel on push to main. Add caching for node_modules, environment variable handling, and Slack notification on failure. Include the workflow file and a setup guide.',
        tags: ['DevOps', 'CI/CD', 'GitHub Actions'],
      },
      {
        title: 'Refactor this Express middleware to use proper error handling',
        description: 'Review and refactor the following Express.js middleware chain that handles auth, validation, and rate limiting. Current issues: errors are swallowed silently, no consistent error format, missing async error catching. Deliver refactored code with centralized error handler, typed error classes, and proper HTTP status codes.',
        tags: ['Code Review', 'Refactoring', 'Express.js'],
      },
      {
        title: 'Write a Bash script to automate daily database backups',
        description: 'Create a Bash script that dumps a PostgreSQL database, compresses it with gzip, uploads to S3 with a timestamped filename, and deletes backups older than 30 days. Include logging, error handling, and a cron schedule recommendation. Deliver the script and setup instructions.',
        tags: ['Bash', 'DevOps', 'Database'],
      },
    ],
  },
  {
    category: 'Research',
    tasks: [
      {
        title: 'Competitive analysis: 8 project management tools with pricing matrix',
        description: 'Research 8 project management tools (Asana, Monday, ClickUp, Linear, Notion, Jira, Basecamp, Trello). For each: pricing tiers, key features, team size limits, integrations count, and API availability. Deliver a comparison matrix table + 1-paragraph recommendation by company size (startup, mid-market, enterprise).',
        tags: ['Market Research', 'SaaS', 'Competitive Analysis'],
      },
      {
        title: 'Research the top 10 AI code generation tools and rank them',
        description: 'Compile a ranked list of 10 AI code generation tools (GitHub Copilot, Cursor, Cody, Tabnine, etc). For each: supported languages, IDE integrations, pricing, accuracy benchmarks if available, and privacy policy summary. Rank by value for a small dev team (5 engineers). Deliver structured report.',
        tags: ['AI Tools', 'Developer Tools', 'Research'],
      },
      {
        title: 'Compile remote work productivity statistics for 2025-2026',
        description: 'Research and compile recent statistics on remote work: productivity metrics, employee satisfaction rates, employer adoption trends, hybrid vs fully remote breakdown, and industry-specific data. Include 15+ data points from reputable sources (McKinsey, Gallup, Buffer, etc). Deliver a structured report with citations.',
        tags: ['Research', 'Remote Work', 'Statistics'],
      },
      {
        title: 'Research API pricing models of 5 AI providers',
        description: 'Compare API pricing for OpenAI, Anthropic, Google Gemini, Mistral, and Cohere. For each: model tiers, per-token pricing, rate limits, free tier details, and enterprise pricing if public. Calculate cost for 1M tokens input + 500K tokens output per month for each. Deliver comparison table + recommendation.',
        tags: ['AI', 'Pricing', 'API'],
      },
    ],
  },
  {
    category: 'Analysis',
    tasks: [
      {
        title: 'Parse and analyze 500 app store reviews for sentiment patterns',
        description: 'Given a dataset of 500 app store reviews (I will provide), classify each as positive/negative/neutral, extract the top 10 recurring complaints, identify 5 most-praised features, and calculate overall sentiment score. Deliver: sentiment breakdown chart data, categorized issues list, and executive summary.',
        tags: ['Data Analysis', 'NLP', 'Sentiment'],
      },
      {
        title: 'Build a unit economics model for a subscription SaaS business',
        description: 'Create a detailed unit economics spreadsheet model for a B2B SaaS product. Include: CAC calculation (by channel), LTV with churn scenarios (2%, 5%, 10%), payback period, gross margin, and break-even analysis. Use realistic assumptions for a $49/mo product. Deliver the model with formulas explained.',
        tags: ['Business Analysis', 'SaaS', 'Financial Model'],
      },
      {
        title: 'Analyze SEO performance and recommend improvements for 10 pages',
        description: 'Audit 10 web pages (URLs provided) for SEO issues: missing meta descriptions, heading structure problems, keyword density, internal linking gaps, page speed indicators, and mobile friendliness. Deliver: issues table per page, priority ranking, and specific fix recommendations.',
        tags: ['SEO', 'Audit', 'Marketing'],
      },
    ],
  },
  {
    category: 'Content',
    tasks: [
      {
        title: 'Write API documentation for 5 REST endpoints',
        description: 'Document 5 REST API endpoints (specs provided in description). For each: endpoint URL, method, headers, request body schema with types, response schema, error codes, example request (curl), example response (JSON), and rate limits. Follow OpenAPI-style formatting. Deliver in markdown.',
        tags: ['Documentation', 'API', 'Technical Writing'],
      },
      {
        title: 'Generate SEO meta descriptions for 20 product pages',
        description: 'Write unique, compelling meta descriptions (150-160 chars each) for 20 product pages. Product names and categories provided. Each must include: primary keyword, value proposition, and call-to-action. Avoid duplicate phrasing across pages. Deliver in a spreadsheet format (page title, URL slug, meta description).',
        tags: ['SEO', 'Copywriting', 'E-commerce'],
      },
      {
        title: 'Write a 3-email onboarding sequence for a developer tool',
        description: 'Create a 3-email welcome sequence for new users of a developer API platform. Email 1 (Day 0): Welcome + API key setup guide. Email 2 (Day 3): First API call tutorial with code snippets. Email 3 (Day 7): Advanced features + community link. Each under 200 words. Include subject lines with A/B variants.',
        tags: ['Email', 'Developer Marketing', 'Onboarding'],
      },
      {
        title: 'Write a technical blog post explaining WebSocket vs SSE',
        description: 'Write a 1000-word technical blog post comparing WebSockets and Server-Sent Events. Cover: how each works, protocol differences, browser support, use cases (chat vs notifications), scaling considerations, and code examples in JavaScript for both. SEO-optimized with clear headings.',
        tags: ['Technical Writing', 'Blog', 'WebDev'],
      },
    ],
  },
  {
    category: 'Social',
    tasks: [
      {
        title: 'Create a 2-week content calendar for a developer tool launch',
        description: 'Design a 14-day social media content calendar for launching a new developer API. Platforms: Twitter/X and LinkedIn. Include: daily post copy (ready to publish), content type (thread, single post, poll), hashtags, and optimal posting time. Mix: 40% educational, 30% product, 20% engagement, 10% behind-the-scenes.',
        tags: ['Social Media', 'Content Calendar', 'Launch'],
      },
      {
        title: 'Write 10 Twitter/X thread hooks for a startup founder',
        description: 'Create 10 attention-grabbing opening tweets for Twitter/X threads. Topics: lessons from scaling to 1K users, mistakes in early hiring, choosing a tech stack, pricing strategy, and cold outreach. Each hook should be under 280 chars and create urgency to read the full thread. Include suggested thread structure.',
        tags: ['Twitter', 'Content', 'Startup'],
      },
    ],
  },
  {
    category: 'Design',
    tasks: [
      {
        title: 'Create a design system spec for a SaaS dashboard',
        description: 'Define a complete design system specification for a SaaS analytics dashboard. Include: color palette (primary, secondary, accent, semantic colors with hex values), typography scale (Google Fonts pairing), spacing system (4px grid), border radius tokens, shadow tokens, button variants (primary, secondary, ghost, danger), and input field states (default, focus, error, disabled).',
        tags: ['Design System', 'UI', 'SaaS'],
      },
      {
        title: 'Write UX copy for a complete checkout flow',
        description: 'Write all microcopy for a 4-step e-commerce checkout: Cart Review, Shipping Info, Payment, Confirmation. Include: page headings, field labels, placeholder text, helper text, validation error messages (15+), button labels, progress indicator text, success/failure states, and email confirmation copy. Tone: clear, trustworthy.',
        tags: ['UX Writing', 'E-commerce', 'Checkout'],
      },
    ],
  },
  {
    category: 'Translation',
    tasks: [
      {
        title: 'Translate SaaS landing page copy to Spanish and French',
        description: 'Translate 500 words of SaaS landing page copy from English to both Spanish and French. Content includes: hero section, feature descriptions, pricing table labels, FAQ, and CTA buttons. Maintain persuasive marketing tone. Adapt idioms culturally rather than translating literally. Flag any phrases that need localization notes.',
        tags: ['Translation', 'Localization', 'Marketing'],
      },
    ],
  },
  {
    category: 'Security',
    tasks: [
      {
        title: 'Review this Node.js API for security vulnerabilities',
        description: 'Audit the following Node.js/Express API code (provided in description) for security issues. Check for: SQL/NoSQL injection, XSS, CSRF, insecure dependencies, hardcoded secrets, missing rate limiting, improper auth token handling, and CORS misconfiguration. Deliver: vulnerability report with severity ratings (Critical/High/Medium/Low), affected code lines, and fix recommendations.',
        tags: ['Security Audit', 'Node.js', 'API'],
      },
    ],
  },
  {
    category: 'Other',
    tasks: [
      {
        title: 'Create a SWOT analysis for entering the EdTech market',
        description: 'Build a detailed SWOT analysis for a startup entering the EdTech space with an AI tutoring product. Include 5+ items per quadrant with explanations. Add: competitive positioning map, key risks with mitigation strategies, and 3 recommended go-to-market actions. Deliver as a structured report.',
        tags: ['Strategy', 'Business Analysis', 'EdTech'],
      },
      {
        title: 'Write a technical RFC for adding real-time notifications',
        description: 'Draft a Request for Comments (RFC) document for adding real-time notifications to a web application. Cover: problem statement, proposed solution (WebSocket vs SSE vs polling), system architecture diagram (text-based), database schema changes, API contract, migration plan, rollback strategy, and performance considerations. Follow standard RFC format.',
        tags: ['RFC', 'Architecture', 'Technical Writing'],
      },
    ],
  },
];

export interface AutoPostResult {
  tasksCreated: number;
  taskIds: string[];
  agentBids: string[];
  errors: string[];
}

export async function autoPostTasks(): Promise<AutoPostResult> {
  const db = await getDb();
  const result: AutoPostResult = { tasksCreated: 0, taskIds: [], agentBids: [], errors: [] };

  // Post 1 task per run (runs 2x/day = 2 tasks/day)
  const taskCount = 1;

  // Build a flat list of all templates
  const allTemplates: Array<{ category: string; title: string; description: string; tags: string[] }> = [];
  for (const cat of TASK_TEMPLATES) {
    for (const t of cat.tasks) {
      allTemplates.push({ category: cat.category, ...t });
    }
  }

  // Shuffle and pick
  const shuffled = allTemplates.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, taskCount);

  for (const template of selected) {
    try {
      const client = CLIENT_POOL[Math.floor(Math.random() * CLIENT_POOL.length)];

      // Budget weighted toward $1: 50% → $1, 15% → $0.50, 35% → $1-$3
      const roll = Math.random();
      let budgetAmount: number;
      if (roll < 0.50) {
        budgetAmount = 1;
      } else if (roll < 0.65) {
        budgetAmount = 0.5;
      } else {
        budgetAmount = 1 + Math.floor(Math.random() * 3); // $1, $2, or $3
      }
      const budget = `$${budgetAmount} USDC`;

      const task = {
        title: template.title,
        description: template.description,
        category: template.category,
        tags: template.tags,
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
          title: template.title,
          category: template.category,
          budget,
        },
        createdAt: new Date(),
      });

      // Directly trigger agent bidding
      try {
        const bidResult = await handleNewTask({
          taskId,
          title: template.title,
          description: template.description,
          category: template.category,
          requirements: '',
          budget,
        });

        if (bidResult.bid) {
          result.agentBids.push(`${bidResult.agent} → "${template.title}"`);
          console.log(`[AUTO-POST] ${bidResult.agent} bid on "${template.title}"`);
        } else {
          console.log(`[AUTO-POST] No agent bid on "${template.title}": ${bidResult.error || 'no match'}`);
        }
      } catch (err: any) {
        console.error(`[AUTO-POST] Agent bidding failed for "${template.title}":`, err.message);
      }

      result.tasksCreated++;
      console.log(`[AUTO-POST] Created "${template.title}" by ${client.name} ($${budgetAmount} USDC)`);
    } catch (error: any) {
      result.errors.push(`${template.title}: ${error.message}`);
      console.error(`[AUTO-POST] Error creating task:`, error.message);
    }
  }

  return result;
}
