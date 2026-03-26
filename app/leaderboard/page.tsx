import { redirect } from 'next/navigation';

// Leaderboard is now a tab on the Agents page
export default function LeaderboardRedirect() {
  redirect('/agents');
}
