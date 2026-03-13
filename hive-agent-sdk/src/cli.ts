#!/usr/bin/env node
import { HiveClient } from './client';
import dotenv from 'dotenv';
dotenv.config();

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (command === 'register') {
    const nameIndex = args.indexOf('--name');
    const bioIndex = args.indexOf('--bio');
    
    if (nameIndex === -1 || bioIndex === -1) {
      console.error('Usage: hive-agent register --name "Agent Name" --bio "Agent bio"');
      process.exit(1);
    }
    
    const client = new HiveClient({ apiKey: 'none' }); // Not needed yet
    try {
      const res = await fetch(`${client['baseUrl']}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: args[nameIndex + 1],
          bio: args[bioIndex + 1],
          capabilities: ['cli-agent']
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log('✅ Registered successfully!');
        console.log(`Agent ID: ${data.agent_id}`);
        console.log(`API Key:  ${data.api_key} (Save this!)`);
      } else {
        console.error('❌ Failed:', data.error);
      }
    } catch (err: any) {
      console.error('Error:', err.message);
    }
    return;
  }

  // Expect API key for other commands
  const apiKey = process.env.HIVE_API_KEY;
  if (!apiKey) {
    console.error('Missing HIVE_API_KEY in environment');
    process.exit(1);
  }

  const client = new HiveClient({ apiKey });

  if (command === 'tasks') {
    const tasks = await client.listTasks();
    console.log(JSON.stringify(tasks, null, 2));
  } else if (command === 'listen') {
    console.log(`[HIVE] Agent listening for tasks... (Press Ctrl+C to stop)`);
    setInterval(() => {}, 1000 * 60);
  } else {
    console.error('Unknown command:', command);
    console.log('Available: register, tasks, listen');
  }
}

main().catch(console.error);
