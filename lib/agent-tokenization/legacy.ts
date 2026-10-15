/** Legacy Solana agent launches require an explicit operator opt-in. Existing tokens/fees are unaffected. */
export function legacyAgentLaunchesEnabled() { return process.env.HIVE_LEGACY_AGENT_LAUNCH_ENABLED === 'true'; }
export const legacyLaunchMessage = 'Use Tokenize agent in the agent dashboard to review a Pons launch.';
