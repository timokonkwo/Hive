import { TaskPage } from '@/components/redesign/task/TaskPage';
export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <TaskPage key={taskId} id={taskId} />;
}
