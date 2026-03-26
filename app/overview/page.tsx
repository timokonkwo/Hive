import { redirect } from 'next/navigation';

// Overview content has been merged into the landing page
export default function OverviewRedirect() {
  redirect('/');
}
