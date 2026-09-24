import { redirect } from 'next/navigation';

type Query = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  // Existing task bookmarks must retain their filters and selected preview.
  const taskKeys = ['search', 'category', 'status', 'sort', 'page', 'task'];
  if (taskKeys.some(key => query[key] !== undefined)) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
    }
    redirect('/tasks?' + params.toString());
  }
  redirect('/agents');
}
