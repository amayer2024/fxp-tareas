import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskRow } from "@/components/tasks/task-row";
import { addDaysISO, todayISO } from "@/lib/dates";
import { fill } from "@/lib/i18n";
import { getMessages } from "@/lib/i18n/server";
import { getSessionProfile } from "@/lib/session";
import {
  listMembersBySpace,
  listMyOpenTasks,
  listSedes,
  listSpaces,
  type TaskRowData,
} from "@/lib/tasks";

export const metadata = { title: "Hoy · FxP Tareas" };

export default async function HoyPage() {
  const profile = await getSessionProfile();
  if (!profile) return null;

  const today = todayISO();
  const weekEnd = addDaysISO(today, 7);
  const t = await getMessages();

  const [tasks, spaces, membersBySpace, sedes] = await Promise.all([
    listMyOpenTasks(profile.id),
    listSpaces(),
    listMembersBySpace(),
    listSedes(),
  ]);

  const overdue = tasks.filter((task) => task.due_date && task.due_date < today);
  const dueToday = tasks.filter((task) => task.due_date === today);
  const thisWeek = tasks.filter(
    (task) => task.due_date && task.due_date > today && task.due_date <= weekEnd,
  );
  const later = tasks.filter(
    (task) => !task.due_date || (task.due_date && task.due_date > weekEnd),
  );

  const defaultSpace = spaces.find((s) => !s.is_private) ?? spaces[0];
  const firstName = profile.full_name.split(" ")[0];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">
          {fill(t.hoy.hello, { name: firstName })}
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {tasks.length === 0
            ? t.hoy.none
            : tasks.length === 1
              ? t.hoy.pendingOne
              : fill(t.hoy.pendingMany, { n: tasks.length })}
        </p>
      </header>

      {defaultSpace ? (
        <QuickAdd
          spaces={spaces}
          membersBySpace={membersBySpace}
          sedes={sedes}
          defaultSpaceId={defaultSpace.id}
        />
      ) : null}

      <Section title={t.hoy.overdue} tasks={overdue} today={today} tone="overdue" />
      <Section title={t.hoy.dueToday} tasks={dueToday} today={today} tone="soon" />
      <Section title={t.hoy.thisWeek} tasks={thisWeek} today={today} />
      <Section title={t.hoy.later} tasks={later} today={today} />

      {tasks.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-sheet px-4 py-10 text-center text-sm text-muted">
          {t.hoy.empty}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  tasks,
  today,
  tone,
}: {
  title: string;
  tasks: TaskRowData[];
  today: string;
  tone?: "overdue" | "soon";
}) {
  if (tasks.length === 0) return null;

  return (
    <section>
      <h2
        className={
          tone === "overdue"
            ? "text-sm font-semibold text-overdue"
            : tone === "soon"
              ? "text-sm font-semibold text-soon"
              : "text-sm font-semibold text-ink"
        }
      >
        {title}
        <span className="ml-1.5 font-normal text-muted">{tasks.length}</span>
      </h2>
      <ul className="mt-1 rounded-card border border-line bg-sheet px-3">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} today={today} showSpace backHref="/hoy" />
        ))}
      </ul>
    </section>
  );
}
