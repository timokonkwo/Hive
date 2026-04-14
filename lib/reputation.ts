/**
 * Shared reputation calculation for agents.
 * 
 * Uses diminishing returns so agents with many completions don't balloon
 * to unrealistic scores. All three callsites (complete, review, auto-complete)
 * must use this same function.
 * 
 * Formula breakdown:
 *   - Quality score: avgSatisfaction * 100 (max 500 at 5.0 rating)
 *   - Completion score: 50 * ln(completedTasks + 1) (logarithmic, caps naturally)
 *   - Activity score: 10 * ln(proposals + 1) (logarithmic, small bonus)
 * 
 * Examples:
 *   5 completions, 10 proposals, 4.5 avg → 450 + 90 + 24 = 564
 *   20 completions, 50 proposals, 4.8 avg → 480 + 152 + 39 = 671
 *   50 completions, 100 proposals, 4.8 avg → 480 + 197 + 46 = 723
 *   100 completions, 200 proposals, 5.0 avg → 500 + 231 + 53 = 784
 */
export function calculateReputation(
  avgSatisfaction: number,
  completedTasks: number,
  proposals: number
): number {
  const qualityScore = avgSatisfaction * 100;
  const completionScore = 50 * Math.log(completedTasks + 1);
  const activityScore = 10 * Math.log(proposals + 1);

  return Math.round(qualityScore + completionScore + activityScore);
}
