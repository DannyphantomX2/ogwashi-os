"use client";

import { useEffect, useRef, useState } from "react";
import { cropLabel, type RemovedEntry } from "@/lib/format";
import { dateLabel } from "@/lib/activityText";

type Page = {
  items: RemovedEntry[];
  nextBefore: string | null;
  summary: { reason: string; n: number }[];
};

export default function RemovedSheet({
  onClose,
  onLoggedOut,
}: {
  onClose: () => void;
  onLoggedOut: () => void;
}) {
  const [items, setItems] = useState<RemovedEntry[] | null>(null);
  const [summary, setSummary] = useState<Page["summary"]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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

  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    setError("");
    async function run() {
      try {
        const res = await fetch("/api/removed", { signal: controller.signal });
        if (res.status === 401) {
          loggedOutRef.current();
          return;
        }
        if (!res.ok) throw new Error("Bad response");
        const data = (await res.json()) as Page;
        setItems(data.items);
        setSummary(data.summary);
        setNextBefore(data.nextBefore);
      } catch {
        if (!controller.signal.aborted) {
          setError("Could not load removed farmers. Check your connection and try again.");
        }
      }
    }
    void run();
    return () => controller.abort();
  }, [reloadKey]);

  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/removed?before=${nextBefore}`);
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

  const total = summary.reduce((sum, s) => sum + s.n, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="removed-title"
      className="fixed inset-0 z-50 flex flex-col bg-stone-50"
    >
      <header
        className="flex items-center justify-between border-b border-stone-200 bg-white px-4 pb-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <h2 id="removed-title" className="text-lg font-semibold text-stone-900">
          Removed farmers
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-11 w-11 rounded-full text-2xl leading-none text-stone-600"
        >
          &times;
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        <p className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
          Their names, phone numbers and locations were deleted for good. Only
          the reason and non-personal details are kept.
        </p>

        {summary.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-stone-900">
              {total} removed in total
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.map((s) => (
                <span
                  key={s.reason}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-800"
                >
                  {s.reason} &middot; {s.n}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
          <div role="status" aria-label="Loading removed farmers" className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className="h-28 rounded-2xl bg-stone-200 motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : items !== null && items.length === 0 ? (
          <p className="px-4 py-12 text-center text-stone-600">
            No farmers have been removed.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(items ?? []).map((r) => (
              <li key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-stone-900">
                    {r.village} &middot; {cropLabel(r.primary_crop)}
                    {r.farm_size_hectares > 0 ? ` \u00b7 ${r.farm_size_hectares} ha` : ""}
                  </p>
                  <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-800">
                    {r.reason}
                  </span>
                </div>
                {r.note && (
                  <p className="mt-2 text-sm text-stone-700">&ldquo;{r.note}&rdquo;</p>
                )}
                <p className="mt-2 text-xs text-stone-500">
                  Registered {dateLabel(r.farmer_created_at)} &middot; Removed{" "}
                  {dateLabel(r.deleted_at)}
                  {r.removed_by ? ` by ${r.removed_by}` : ""}
                </p>
              </li>
            ))}
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
