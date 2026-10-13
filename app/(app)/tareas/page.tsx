import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskRow } from "@/components/tasks/task-row";
import { todayISO } from "@/lib/dates";
import { fill } from "@/lib/i18n";
import { getMessages } from "@/lib/i18n/server";
import { listBackHref } from "@/lib/paths";
import {
  listMembersBySpace,
  listPeople,
  listSedes,
  listSpaces,
  listTasks,
} from "@/lib/tasks";

export const metadata = { title: "Tareas · FxP Tareas" };

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{
    space?: string;
    assignee?: string;
    status?: string;
    sede?: string;
  }>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const t = await getMessages();
  const backHref = listBackHref("/tareas", sp);

  const [tasks, spaces, people, membersBySpace, sedes] = await Promise.all([
    listTasks({
      spaceId: sp.space,
      assigneeId: sp.assignee,
      status: sp.status ?? "open",
      sedeId: sp.sede,
    }),
    listSpaces(),
    listPeople(),
    listMembersBySpace(),
    listSedes(),
  ]);

  const defaultSpace =
    spaces.find((s) => s.id === sp.space) ??
    spaces.find((s) => !s.is_private) ??
    spaces[0];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">{t.tareas.title}</h1>
        <p className="mt-0.5 text-sm text-muted">
          {tasks.length === 1
            ? t.tareas.countOne
            : fill(t.tareas.countMany, { n: tasks.length })}
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

      <TaskFilters spaces={spaces} people={people} sedes={sedes} />

      {tasks.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-sheet px-4 py-10 text-center text-sm text-muted">
          {t.tareas.empty}
        </p>
      ) : (
        <ul className="rounded-card border border-line bg-sheet px-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              showSpace
              backHref={backHref}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
