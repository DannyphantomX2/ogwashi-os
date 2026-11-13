"use client";

import { useEffect, useRef, useState } from "react";
import type { ActivityEntry } from "@/lib/format";
import { dayLabel, describe, timeLabel, type Tone } from "@/lib/activityText";

const GROUPS = [
  { id: "all", label: "Everything" },
  { id: "logins", label: "Logins" },
  { id: "farmers", label: "Farmers" },
  { id: "team", label: "Team" },
  { id: "alerts", label: "Exports & alerts" },
] as const;
type Group = (typeof GROUPS)[number]["id"];

const DOT: Record<Tone, string> = {
  good: "bg-green-600",
  warn: "bg-amber-500",
  bad: "bg-red-600",
  neutral: "bg-stone-400",
};

type Page = { items: ActivityEntry[]; nextBefore: string | null };

export default function ActivitySheet({
  onClose,
  onLoggedOut,
}: {
  onClose: () => void;
  onLoggedOut: () => void;
}) {
  const [group, setGroup] = useState<Group>("all");
  const [person, setPerson] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [items, setItems] = useState<ActivityEntry[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Keep the latest callback without re-running the loading effect
  const loggedOutRef = useRef(onLoggedOut);
  useEffect(() => {
    loggedOutRef.current = onLoggedOut;
  });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Names for the "who" filter
  useEffect(() => {
    const controller = new AbortController();
    async function run() {
      try {
        const res = await fetch("/api/users", { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        setPeople((data.users as { username: string }[]).map((u) => u.username));
      } catch {
        // The filter is optional, so ignore failures
      }
    }
    void run();
    return () => controller.abort();
  }, []);

  function query(before: string | null): string {
    const params = new URLSearchParams({ group });
    if (person) params.set("person", person);
    if (before) params.set("before", before);
    return `/api/activity?${params.toString()}`;
  }

  // First page (again whenever the filters change)
  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    setNextBefore(null);
    setError("");
    async function run() {
      try {
        const params = new URLSearchParams({ group });
        if (person) params.set("person", person);
        const res = await fetch(`/api/activity?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.status === 401) {
          loggedOutRef.current();
          return;
        }
        if (!res.ok) throw new Error("Bad response");
        const data = (await res.json()) as Page;
        setItems(data.items);
        setNextBefore(data.nextBefore);
      } catch {
        if (!controller.signal.aborted) {
          setError("Could not load the activity log. Check your connection and try again.");
        }
      }
    }
    void run();
    return () => controller.abort();
  }, [group, person, reloadKey]);

  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(query(nextBefore));
      if (res.status === 401) {
        onLoggedOut();
        return;
      }
      if (!res.ok) throw new Error("Bad response");
      const data = (await res.json()) as Page;
      setItems((prev) => [...(prev ?? []), ...data.items]);
      setNextBefore(data.nextBefore);
    } catch {
      setError("Could not load more. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  let lastDay = "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-title"
      className="fixed inset-0 z-50 flex flex-col bg-stone-50"
    >
      <header
        className="flex items-center justify-between border-b border-stone-200 bg-white px-4 pb-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <h2 id="activity-title" className="text-lg font-semibold text-stone-900">
          Activity
        </h2>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="h-11 rounded-lg px-3 text-sm font-semibold text-green-800"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-11 w-11 rounded-full text-2xl leading-none text-stone-600"
          >
            &times;
          </button>
        </div>
      </header>

      <div className="border-b border-stone-200 bg-white px-4 py-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={group === g.id}
              onClick={() => setGroup(g.id)}
              className={`flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
                group === g.id
                  ? "border-green-800 bg-green-800 text-white"
                  : "border-stone-300 bg-white text-stone-800"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        {people.length > 0 && (
          <select
            aria-label="Show activity by"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30"
          >
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        {error && (
          <div role="alert" className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => (items ? loadMore() : setReloadKey((k) => k + 1))}
              className="mt-2 h-10 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {items === null && !error ? (
          <div role="status" aria-label="Loading activity" className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className="h-16 rounded-xl bg-stone-200 motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : items !== null && items.length === 0 ? (
          <p className="px-4 py-12 text-center text-stone-600">
            Nothing here yet for this filter.
          </p>
        ) : (
          <ul className="space-y-2">
            {(items ?? []).map((e) => {
              const day = dayLabel(e.at);
              const showDay = day !== lastDay;
              lastDay = day;
              const { text, extra, tone } = describe(e);
              return (
                <li key={e.id} className="list-none">
                  {showDay && (
                    <h3 className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {day}
                    </h3>
                  )}
                  <div className="flex gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[tone]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-stone-900">{text}</p>
                      {extra && <p className="mt-0.5 text-sm text-stone-600">{extra}</p>}
                      <p className="mt-1 text-xs text-stone-500">
                        {timeLabel(e.at)}
                        {e.farmer_id ? ` \u00b7 Farmer #${e.farmer_id}` : ""}
                        {e.ip && e.ip !== "local" ? ` \u00b7 ${e.ip}` : ""}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {nextBefore && items !== null && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-4 h-12 w-full rounded-xl border border-stone-300 bg-white text-base font-semibold text-stone-800 disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
