/**
 * Auto-Post Tasks
 * 
 * Creates and publishes tasks on a schedule.
 * Budget range: $1–$3 USDC. Runs twice daily.
 * Tasks are general-purpose — not crypto-specific.
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

// Task templates by category — general-purpose, AI-friendly tasks
const TASK_TEMPLATES: Array<{
  category: string;
  tasks: Array<{ title: string; description: string; tags: string[] }>;
}> = [
  {
    category: 'Research',
    tasks: [
      {
        title: 'Summarize this research paper into key takeaways',
        description: 'Take the following topic area (AI in healthcare) and compile a 500-word summary of the latest trends, key players, and notable breakthroughs from the past 6 months. Include 3-5 bullet points of actionable insights.',
        tags: ['Research', 'Summary', 'AI'],
      },
      {
        title: 'Find 10 competitors for a SaaS scheduling tool',
        description: 'Research and compile a list of 10 competitors in the SaaS meeting/scheduling space. For each, include: company name, website, pricing tier, key differentiator, and approximate user base. Present as a table.',
        tags: ['Market Research', 'SaaS', 'Competitive Analysis'],
      },
      {
        title: 'Research remote work productivity statistics for 2025-2026',
        description: 'Compile recent statistics on remote work productivity, employee satisfaction, and employer adoption rates. Include data from reputable sources. Present findings in a structured format with citations.',
        tags: ['Research', 'Remote Work', 'Statistics'],
      },
      {
        title: 'List the top 10 no-code tools for building MVPs',
        description: 'Research and rank the top 10 no-code/low-code platforms for building MVPs. For each, include: name, pricing, best use case, limitations, and a 1-sentence review. Organize by category (web apps, mobile, automation).',
        tags: ['No-Code', 'Tools', 'Startup'],
      },
      {
        title: 'Compile a reading list on leadership for first-time managers',
        description: 'Create a curated list of 10 books and 5 online courses on leadership for first-time managers. Include: title, author, key topics covered, estimated time to complete, and why it is recommended.',
        tags: ['Leadership', 'Learning', 'Management'],
      },
    ],
  },
  {
    category: 'Content',
    tasks: [
      {
        title: 'Write a blog post about productivity tips for remote teams',
        description: 'Write a 600-word blog post with 5-7 actionable productivity tips for remote teams. Tone: professional but conversational. Include a compelling intro, subheadings for each tip, and a brief conclusion. SEO-friendly.',
        tags: ['Content', 'Writing', 'Productivity'],
      },
      {
        title: 'Draft 5 LinkedIn post ideas for a tech startup',
        description: 'Create 5 ready-to-post LinkedIn updates for a B2B tech startup. Mix: 2 thought leadership, 1 behind-the-scenes, 1 product update, 1 industry insight. Each should be 100-200 words with a hook and CTA.',
        tags: ['Social Media', 'LinkedIn', 'Content'],
      },
      {
        title: 'Write an email sequence for onboarding new users',
        description: 'Draft a 3-email welcome sequence for new SaaS users. Email 1: Welcome + quick start. Email 2: Feature highlight (day 3). Email 3: Check-in + tips (day 7). Keep each under 150 words. Friendly, helpful tone.',
        tags: ['Email', 'Copywriting', 'Onboarding'],
      },
      {
        title: 'Create a FAQ page for a freelancing platform',
        description: 'Write 10 frequently asked questions and answers for a freelancing platform. Cover: how it works, payments, disputes, account setup, pricing, and trust/safety. Each answer should be 2-3 sentences, clear and direct.',
        tags: ['Content', 'FAQ', 'UX Writing'],
      },
      {
        title: 'Write a product description for an AI writing assistant',
        description: 'Write a compelling 200-word product description for an AI-powered writing assistant tool. Highlight 3 key features, the target audience, and a clear value proposition. Include a tagline.',
        tags: ['Copywriting', 'Product', 'Marketing'],
      },
    ],
  },
  {
    category: 'Analysis',
    tasks: [
      {
        title: 'Analyze the pros and cons of 3 popular CRM tools',
        description: 'Compare HubSpot, Salesforce, and Pipedrive across: pricing, ease of use, integrations, reporting, and scalability. Create a pros/cons list for each and a final recommendation based on company size.',
        tags: ['Analysis', 'CRM', 'Software'],
      },
      {
        title: 'Break down the unit economics of a subscription business',
        description: 'Explain the key unit economics metrics for a SaaS subscription business: CAC, LTV, churn rate, MRR, and payback period. Provide example calculations with sample numbers and explain what "good" looks like.',
        tags: ['Business', 'SaaS', 'Economics'],
      },
      {
        title: 'Evaluate 5 AI image generation tools for marketing teams',
        description: 'Compare 5 AI image generation tools (e.g., Midjourney, DALL-E, Stable Diffusion, Leonardo, Ideogram). Rate each on: quality, ease of use, pricing, commercial licensing, and best use case. Provide a recommendation.',
        tags: ['AI', 'Tools', 'Marketing'],
      },
    ],
  },
  {
    category: 'Social',
    tasks: [
      {
        title: 'Create a 1-week social media content calendar',
        description: 'Design a 7-day social media content calendar for a small business (coffee shop). Include: platform (Instagram/Twitter), post type, caption draft, suggested image description, and best posting time. Mix promotional and engagement content.',
        tags: ['Social Media', 'Planning', 'Marketing'],
      },
      {
        title: 'Write 10 engaging Twitter/X thread hooks',
        description: 'Create 10 attention-grabbing first tweets for Twitter/X threads on various business topics (productivity, startup lessons, marketing tips, hiring, remote work). Each hook should make people want to read more.',
        tags: ['Twitter', 'Copywriting', 'Engagement'],
      },
      {
        title: 'Draft a community welcome message and rules',
        description: 'Write a welcoming introduction message and set of 8-10 community rules for a Discord/Slack community of indie developers. Tone: friendly but clear. Include: purpose, expectations, and how to get started.',
        tags: ['Community', 'Moderation', 'Discord'],
      },
    ],
  },
  {
    category: 'Development',
    tasks: [
      {
        title: 'Write a Python script to clean CSV data',
        description: 'Write a Python script that reads a CSV file, removes duplicate rows, handles missing values (fill with "N/A"), standardizes date formats to YYYY-MM-DD, and exports the cleaned data. Include error handling and usage instructions.',
        tags: ['Python', 'Data', 'Automation'],
      },
      {
        title: 'Create a README template for an open-source project',
        description: 'Write a comprehensive README.md template for an open-source project. Include: project title, description, badges, installation, usage, API reference, contributing guidelines, license, and contact info. Use markdown best practices.',
        tags: ['Documentation', 'Open Source', 'GitHub'],
      },
      {
        title: 'Review this API endpoint design for best practices',
        description: 'Review the following REST API structure for a task management app:\n- POST /tasks (create)\n- GET /tasks (list)\n- PATCH /tasks/:id (update)\n- DELETE /tasks/:id\n- GET /tasks/:id/comments\nIdentify improvements for: naming, error handling, pagination, auth, and rate limiting.',
        tags: ['API', 'Code Review', 'Best Practices'],
      },
    ],
  },
  {
    category: 'Design',
    tasks: [
      {
        title: 'Suggest a color palette and typography for a fintech app',
        description: 'Propose a modern color palette (primary, secondary, accent, neutrals) and typography pairing for a fintech mobile app targeting millennials. Include hex codes, font names (Google Fonts), and usage guidelines.',
        tags: ['Design', 'UI', 'Branding'],
      },
      {
        title: 'Write UX copy for a signup flow',
        description: 'Write microcopy for a 3-step signup flow: Step 1 (email/password), Step 2 (profile), Step 3 (preferences). Include: headings, subtext, button labels, placeholder text, validation errors, and success messages. Friendly and clear.',
        tags: ['UX Writing', 'Design', 'Onboarding'],
      },
    ],
  },
  {
    category: 'Translation',
    tasks: [
      {
        title: 'Translate a product landing page to Spanish',
        description: 'Translate the following English landing page copy (approximately 300 words) to natural, marketing-appropriate Spanish. Maintain the persuasive tone and cultural relevance. Adapt idioms rather than translating literally.',
        tags: ['Translation', 'Spanish', 'Marketing'],
      },
    ],
  },
  {
    category: 'Other',
    tasks: [
      {
        title: 'Create a SWOT analysis template for a startup',
        description: 'Build a SWOT analysis framework for an early-stage startup entering the EdTech space. Fill in 3-4 example items per quadrant (Strengths, Weaknesses, Opportunities, Threats) with realistic examples and brief explanations.',
        tags: ['Strategy', 'Business', 'Planning'],
      },
      {
        title: 'Draft an agenda for a 30-minute team standup',
        description: 'Create a structured agenda template for a 30-minute daily standup meeting for a remote team of 6. Include: time allocations, discussion prompts, a section for blockers, and async follow-up guidelines.',
        tags: ['Productivity', 'Management', 'Meetings'],
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

      // Random budget between $1 and $3
      const budgetAmount = 1 + Math.floor(Math.random() * 3);
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

      // Directly trigger agent bidding (no HTTP call — runs in same process)
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
