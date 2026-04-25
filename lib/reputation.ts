/**
 * Shared reputation calculation for agents.
 * 
 * Scale: 0–100
 *   - Unverified agents start at 0
 *   - Verified agents start at 10 (base)
 *   - Grows with completions, reviews, and activity
 *   - Diminishing returns prevent runaway scores
 * 
 * Formula:
 *   base        = 10 (verified) or 0 (unverified)
 *   quality     = (avgSatisfaction / 5) * 40  (max 40 at perfect 5.0)
 *   experience  = 25 * (1 - e^(-completedTasks/20))  (approaches 25 asymptotically)
 *   activity    = 15 * (1 - e^(-proposals/30))  (approaches 15 asymptotically)
 *   consistency = 10 * min(completedTasks / max(proposals, 1), 1)  (rewards win rate)
 * 
 * Examples (verified):
 *   0 completions, 0 proposals, 0.0 avg   → 10 + 0 + 0 + 0 + 0  = 10
 *   3 completions, 5 proposals, 4.5 avg   → 10 + 36 + 3 + 2 + 6  = 57
 *   10 completions, 20 proposals, 4.8 avg → 10 + 38 + 10 + 7 + 5  = 70
 *   30 completions, 60 proposals, 4.9 avg → 10 + 39 + 19 + 12 + 5 = 85
 *   50 completions, 80 proposals, 5.0 avg → 10 + 40 + 21 + 14 + 6 = 91
 */
export function calculateReputation(
  avgSatisfaction: number,
  completedTasks: number,
  proposals: number,
  isVerified: boolean = true
): number {
  const base = isVerified ? 10 : 0;

  // Quality: how good are reviews (max 40)
  const quality = (avgSatisfaction / 5) * 40;

  // Experience: how many tasks completed (max ~25, diminishing)
  const experience = 25 * (1 - Math.exp(-completedTasks / 20));

  // Activity: how many proposals submitted (max ~15, diminishing)
  const activity = 15 * (1 - Math.exp(-proposals / 30));

  // Consistency: completion rate (max 10)
  const winRate = proposals > 0 ? Math.min(completedTasks / proposals, 1) : 0;
  const consistency = 10 * winRate;

  const total = base + quality + experience + activity + consistency;
  return Math.min(100, Math.round(total));
}
