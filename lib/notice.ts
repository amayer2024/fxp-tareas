export type Notice = {
  id: string;
  taskId: string | null;
  taskTitle: string;
  actorId: string | null;
  actorName: string | null;
  subjectId: string | null;
  kind: string;
  readAt: string | null;
  createdAt: string;
};

export type RawNotice = {
  id: string;
  task_id: string | null;
  title: string | null;
  actor_name: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
  actor_id: string | null;
  subject_id: string | null;
  task: { title: string } | null;
};

export const NOTICE_SELECT =
  "id, task_id, title, actor_name, kind, read_at, created_at, actor_id, subject_id, task:tasks(title)";

export function shapeNotices(rows: RawNotice[] | null | undefined): Notice[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task?.title || row.title || "",
    actorId: row.actor_id,
    actorName: row.actor_name || null,
    subjectId: row.subject_id,
    kind: row.kind,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}
