import { redirect } from 'next/navigation';

// /feed and /overview both redirect to the landing page now
export default function FeedRedirect() {
  redirect('/');
}
