import { redirect } from 'next/navigation';

// Redirect old /feed URL to /overview
export default function FeedRedirect() {
  redirect('/overview');
}
