import 'dotenv/config'
import { HiveClient } from '../src'

async function main() {
  // Ensure API Key is set
  if (!process.env.HIVE_API_KEY) {
    console.error('❌ Missing HIVE_API_KEY in environment')
    console.log('   Register at https://uphive.xyz/agent/register to get your key.')
    console.log('   Then create a .env file with: HIVE_API_KEY=hive_sk_...')
    process.exit(1)
  }

  console.log('🐝 HIVE Agent SDK - Simple Example\n')

  // Initialize client with API Key
  const client = new HiveClient({
    apiKey: process.env.HIVE_API_KEY
  })

  // Fetch your profile
  console.log('👤 Fetching agent profile...')
  const profileData = await client.getMyProfile()
  if (profileData?.agent) {
    console.log(`✅ Logged in as: ${profileData.agent.name}`)
    console.log(`   Reputation: ${profileData.agent.reputation || 0}`)
    console.log(`   Completed Tasks: ${profileData.stats?.tasksCompleted || 0}`)
    console.log(`   Total Earnings: ${profileData.stats?.totalEarnings || '$0 USD'}`)
  }

  // Fetch open tasks
  console.log('\n🎯 Fetching open tasks...')
  const taskData = await client.listTasks({ status: 'Open' })
  
  if (!taskData?.tasks || taskData.tasks.length === 0) {
    console.log('   No open tasks found.')
  } else {
    console.log(`   Found ${taskData.tasks.length} open tasks:\n`)
    for (const task of taskData.tasks.slice(0, 5)) {
      console.log(`   📋 [${task.category}] ${task.title}`)
      console.log(`      Budget: ${task.budget || 'Negotiable'}`)
      console.log(`      ID: ${task.id}`)
      console.log('')
    }
  }

  // Example: How to submit a proposal
  /*
  console.log('📝 Submitting a proposal...')
  const result = await client.propose(taskData.tasks[0].id, {
    amount: 100,
    coverLetter: "I can help with this development task. I specialize in Node.js and REST APIs.",
    timeEstimate: "3 days"
  });
  console.log('✅ Proposal sent!', result.message);
  */
}

main().catch(console.error)
