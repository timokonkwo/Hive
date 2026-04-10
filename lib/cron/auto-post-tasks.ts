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
    weight: 25, // percentage chance of being picked
    guidance: 'Code tasks: scripts, APIs, unit tests, CI/CD pipelines, refactoring, automation, CLI tools. Languages: Python, TypeScript, Node.js, Bash.',
    examples: [
      'Write a Python script to scrape product prices from 3 competitor websites and output a comparison CSV',
      'Build a REST API endpoint in Express.js that validates CSV uploads and returns cleaned JSON',
      'Create a GitHub Actions CI/CD pipeline for a Node.js app with lint, test, build, and deploy',
      'Write a Bash script to automate daily PostgreSQL backups to S3 with rotation',
      'Refactor an Express middleware chain to use centralized error handling and typed error classes',
    ],
    tags: ['Python', 'Node.js', 'API', 'Automation', 'TypeScript', 'DevOps', 'Testing'],
  },
  {
    name: 'Research',
    weight: 20,
    guidance: 'Competitive analysis, market research, tool comparisons, pricing research, industry reports. Structured output with data tables.',
    examples: [
      'Compare 8 project management tools with a pricing and feature matrix',
      'Research and rank the top 10 AI code generation tools for a dev team',
      'Compile remote work productivity statistics from reputable sources',
      'Research API pricing for 5 AI providers and calculate monthly costs',
    ],
    tags: ['Market Research', 'Competitive Analysis', 'Tools', 'Statistics', 'AI'],
  },
  {
    name: 'Analysis',
    weight: 15,
    guidance: 'Data analysis, sentiment analysis, unit economics, SEO audits, financial modeling. Quantitative with structured output.',
    examples: [
      'Parse 500 app store reviews and generate a sentiment breakdown with top complaints',
      'Build a unit economics model for a $49/mo SaaS product with churn scenarios',
      'Audit 10 web pages for SEO issues and provide fix recommendations',
    ],
    tags: ['Data Analysis', 'SEO', 'Financial Model', 'Audit', 'NLP'],
  },
  {
    name: 'Content',
    weight: 20,
    guidance: 'API documentation, technical blog posts, email sequences, SEO copy, product descriptions. Professional, specific, with clear deliverable format.',
    examples: [
      'Write API documentation for 5 REST endpoints in OpenAPI-style markdown',
      'Generate unique SEO meta descriptions for 20 product pages',
      'Write a 3-email onboarding sequence for a developer API platform',
      'Write a technical blog post comparing WebSockets vs Server-Sent Events with code examples',
    ],
    tags: ['Technical Writing', 'Documentation', 'SEO', 'Copywriting', 'Email'],
  },
  {
    name: 'Social',
    weight: 5,
    guidance: 'Content calendars, Twitter/X threads, LinkedIn posts, community copy. Platform-specific, with actual draft copy.',
    examples: [
      'Create a 2-week social media content calendar for a developer tool launch',
      'Write 10 Twitter/X thread hooks for a startup founder on business topics',
    ],
    tags: ['Social Media', 'Content Calendar', 'Twitter', 'LinkedIn'],
  },
  {
    name: 'Design',
    weight: 5,
    guidance: 'Design system specs, UX copy, style guides, checkout flows. Written deliverables (not visual).',
    examples: [
      'Create a design system spec with color palette, typography, spacing, and component tokens',
      'Write UX copy for a complete 4-step e-commerce checkout flow',
    ],
    tags: ['Design System', 'UX Writing', 'UI', 'E-commerce'],
  },
  {
    name: 'Security',
    weight: 5,
    guidance: 'Code security audits, vulnerability assessments, dependency reviews. Structured report with severity ratings.',
    examples: [
      'Review a Node.js API for security vulnerabilities and deliver a severity-rated report',
      'Audit npm dependencies for known CVEs and recommend alternatives',
    ],
    tags: ['Security Audit', 'Node.js', 'Vulnerability'],
  },
  {
    name: 'Other',
    weight: 5,
    guidance: 'Business planning, SWOT analysis, RFCs, technical architecture docs, process documents.',
    examples: [
      'Create a SWOT analysis for entering the EdTech market with an AI tutoring product',
      'Write a technical RFC for adding real-time notifications to a web app',
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
${category.examples.map(e => `- ${e}`).join('\n')}
${avoidList}

RULES:
- The task should be something a client would delegate to an AI agent (not something trivial enough for a quick ChatGPT prompt)
- It should require multi-step work, structured output, or domain expertise
- Title: concise, action-oriented, under 80 characters
- Description: 2-4 sentences explaining what to deliver, format expectations, and scope. Under 300 characters.
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
    c.examples.map(e => ({ title: e, category: c.name, tags: c.tags }))
  );
  const unused = allExamples.filter(e => !recentLower.has(e.title.toLowerCase()));
  const pool = unused.length > 0 ? unused : allExamples;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  return {
    title: pick.title,
    description: `Complete this ${pick.category.toLowerCase()} task. Deliver structured, professional output with clear documentation.`,
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
