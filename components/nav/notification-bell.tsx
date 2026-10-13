"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/(app)/notificaciones/actions";
import { useI18n } from "@/components/i18n/provider";
import { formatRelativeTime } from "@/lib/dates";
import { fill } from "@/lib/i18n";
import {
  NOTICE_SELECT,
  shapeNotices,
  type Notice,
  type RawNotice,
} from "@/lib/notice";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

async function pullNotices(): Promise<Notice[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select(NOTICE_SELECT)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  return shapeNotices(data as unknown as RawNotice[]);
}

function visibleNotices(incoming: Notice[], dismissed: Set<string>): Notice[] {
  return incoming.filter((n) => !n.readAt && !dismissed.has(n.id));
}

type Inbox = {
  items: Notice[];
  unread: number;
  viewerId: string;
  markOne: (notice: Notice) => void;
  markAll: () => void;
  refresh: () => void;
};

const InboxContext = createContext<Inbox | null>(null);

export function NotificationInbox({
  items: initial,
  viewerId,
  children,
}: {
  items: Notice[];
  viewerId: string;
  children: ReactNode;
}) {
  const [items, setItems] = useState(() =>
    initial.filter((n) => !n.readAt),
  );
  const dismissed = useRef(new Set<string>());

  const refresh = useCallback(() => {
    void pullNotices().then((incoming) => {
      setItems(visibleNotices(incoming, dismissed.current));
    });
  }, []);

  useEffect(() => {
    setItems(visibleNotices(initial, dismissed.current));
  }, [initial]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 8000);
    function onFocus() {
      refresh();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const unread = items.length;

  const markOne = useCallback((notice: Notice) => {
    dismissed.current.add(notice.id);
    setItems((prev) => prev.filter((n) => n.id !== notice.id));
    const readAt = new Date().toISOString();
    const supabase = createClient();
    void supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notice.id)
      .is("read_at", null)
      .then(() => markNotificationReadAction(notice.id));
  }, []);

  const markAll = useCallback(() => {
    if (items.length === 0) return;
    for (const notice of items) dismissed.current.add(notice.id);
    setItems([]);
    const readAt = new Date().toISOString();
    const supabase = createClient();
    void supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", viewerId)
      .is("read_at", null)
      .then(() => markAllNotificationsReadAction());
  }, [items, viewerId]);

  const value = useMemo(
    () => ({ items, unread, viewerId, markOne, markAll, refresh }),
    [items, unread, viewerId, markOne, markAll, refresh],
  );

  return (
    <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
  );
}

function useInbox(): Inbox {
  const inbox = useContext(InboxContext);
  if (!inbox) {
    throw new Error("NotificationBell must sit inside NotificationInbox");
  }
  return inbox;
}

export function NotificationBell({
  tone = "light",
}: {
  tone?: "light" | "dark";
}) {
  const { t } = useI18n();
  const { items, unread, viewerId, markOne, markAll, refresh } = useInbox();
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    const tick = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.clearInterval(tick);
    };
  }, [open]);

  function headline(notice: Notice) {
    const self = notice.actorId != null && notice.actorId === viewerId;
    if (notice.kind === "done") {
      if (self) return t.notify.doneSelf;
      if (notice.actorName) return fill(t.notify.done, { actor: notice.actorName });
      return t.notify.doneNoActor;
    }
    if (notice.kind === "deleted") {
      if (self) return t.notify.deletedSelf;
      if (notice.actorName)
        return fill(t.notify.deleted, { actor: notice.actorName });
      return t.notify.deletedNoActor;
    }
    const actor = notice.actorName ?? t.task.someone;
    const assignedToViewer =
      notice.subjectId != null && notice.subjectId === viewerId;
    if (assignedToViewer && self) return t.notify.assignedSelf;
    if (assignedToViewer) {
      return fill(t.notify.assigned, { actor });
    }
    if (self || (notice.actorId != null && notice.actorId === notice.subjectId)) {
      return fill(t.notify.assignedSelfOther, { actor });
    }
    if (notice.actorName) return fill(t.notify.assignedOther, { actor });
    return t.notify.assignedNoActor;
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label={
          unread > 0 ? `${t.notify.title} (${unread})` : t.notify.title
        }
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (!open) refresh();
          setOpen((v) => !v);
        }}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-[10px]",
          tone === "dark"
            ? "text-white hover:bg-white/10"
            : "text-ink hover:bg-hover",
        )}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-[6px] bg-overdue px-1 text-[10px] font-medium text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-[min(calc(100vw-2rem),20rem)] overflow-hidden rounded-[12px] border border-line bg-sheet shadow-lg md:right-auto md:left-0"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t.notify.title}
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="text-[11px] text-muted hover:text-pitch"
              >
                {t.notify.markAll}
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="px-3.5 py-6 text-sm text-muted">{t.notify.empty}</p>
          ) : (
            <ul className="max-h-[min(24rem,70vh)] overflow-auto py-1">
              {items.map((notice) => {
                const body = (
                  <>
                    <span className="block text-[13px] font-medium text-ink">
                      {headline(notice)}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">
                      {notice.taskTitle}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted">
                      {formatRelativeTime(notice.createdAt, t)}
                    </span>
                  </>
                );
                const className = "block px-3.5 py-2.5 hover:bg-hover";
                return (
                  <li key={notice.id}>
                    {notice.taskId ? (
                      <Link
                        href={`/tareas/${notice.taskId}`}
                        role="menuitem"
                        onClick={() => {
                          markOne(notice);
                          setOpen(false);
                        }}
                        className={className}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => markOne(notice)}
                        className={cn(className, "w-full text-left")}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
