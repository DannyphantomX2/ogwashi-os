"use client";

import { useEffect, useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import AddFarmerSheet from "@/components/AddFarmerSheet";
import DeleteFarmerSheet from "@/components/DeleteFarmerSheet";
import ChangePasswordSheet from "@/components/ChangePasswordSheet";
import TeamSheet from "@/components/TeamSheet";
import { useLeaves } from "@/components/LeavesBackground";
import ActivitySheet from "@/components/ActivitySheet";
import RemovedSheet from "@/components/RemovedSheet";
import { type MenuItem } from "@/components/HeaderMenu";
import AppHeader from "@/components/AppHeader";
import FarmerCard from "@/components/FarmerCard";
import FilterBar, { type Filters } from "@/components/FilterBar";
import StatsStrip from "@/components/StatsStrip";
import {
  FarmerListSkeleton,
  PageSkeleton,
  StatsSkeleton,
} from "@/components/Skeletons";
import type { Farmer, Me, Stats } from "@/lib/format";

type Status = "loading" | "login" | "ready";
const noFilters: Filters = { q: "", village: "", crop: "" };

export default function Home() {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Farmer | null>(null);
  const [editing, setEditing] = useState<Farmer | null>(null);
  const [showTeam, setShowTeam] = useState(false);
  const [leavesOn, setLeavesOn] = useLeaves();
  const [showActivity, setShowActivity] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [toast, setToast] = useState("");

  const isAdmin = me?.role === "admin";
  const filtersActive =
    filters.q.trim() !== "" || filters.village !== "" || filters.crop !== "";

  // Wait until typing pauses before searching
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q.trim()), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  // Load the farmer list (runs again when filters change)
  useEffect(() => {
    const controller = new AbortController();
    async function run() {
      setSearching(true);
      setLoadFailed(false);
      try {
        const params = new URLSearchParams();
        if (debouncedQ) params.set("q", debouncedQ);
        if (filters.village) params.set("village", filters.village);
        if (filters.crop) params.set("crop", filters.crop);
        const res = await fetch(`/api/farmers?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.status === 401) {
          setStatus("login");
          return;
        }
        // 403 means "choose a new password first". The screen for that is
        // shown once we know who is logged in, so do nothing here.
        if (res.status === 403) return;
        if (!res.ok) throw new Error("Bad response");
        const data = await res.json();
        setFarmers(data.farmers);
        setStatus("ready");
      } catch {
        if (controller.signal.aborted) return;
        setLoadFailed(true);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }
    void run();
    return () => controller.abort();
  }, [debouncedQ, filters.village, filters.crop, reloadKey]);

  // Load the summary numbers (not affected by filters)
  useEffect(() => {
    const controller = new AbortController();
    async function run() {
      setStatsFailed(false);
      try {
        const res = await fetch("/api/stats", { signal: controller.signal });
        if (res.status === 401) {
          setStatus("login");
          return;
        }
        if (res.status === 403) return;
        if (!res.ok) throw new Error("Bad response");
        setStats(await res.json());
      } catch {
        if (!controller.signal.aborted) setStatsFailed(true);
      }
    }
    void run();
    return () => controller.abort();
  }, [reloadKey]);

  // Who is logged in (decides which buttons and screens are shown)
  useEffect(() => {
    const controller = new AbortController();
    async function run() {
      try {
        const res = await fetch("/api/me", { signal: controller.signal });
        if (res.status === 401) {
          setStatus("login");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setMe(data.user);
        }
      } catch {
        // If this fails, the admin-only buttons simply stay hidden
      }
    }
    void run();
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function updateFilters(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
  }

  function clearFilters() {
    setFilters(noFilters);
    setDebouncedQ("");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    setFarmers([]);
    setStats(null);
    setStatsFailed(false);
    setMe(null);
    setShowTeam(false);
    setShowActivity(false);
    setShowRemoved(false);
    setChangingPassword(false);
    clearFilters();
    setStatus("login");
  }

  async function exportCsv() {
    try {
      const res = await fetch("/api/export");
      if (res.status === 401) {
        setStatus("login");
        return;
      }
      if (res.status === 403) {
        setToast("Only admins can export.");
        return;
      }
      if (!res.ok) throw new Error("Bad response");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ogwashi-farmers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast("Export downloaded");
    } catch {
      setToast("Export failed. Try again.");
    }
  }

  if (status === "login") {
    return (
      <LoginScreen
        onSuccess={() => {
          setStatus("loading");
          setMe(null);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  // First login with a temporary password: must choose their own first
  if (me?.mustChangePassword) {
    return (
      <ChangePasswordSheet
        forced
        onClose={() => {}}
        onLogout={logout}
        onChanged={() => {
          setMe(null);
          setStatus("loading");
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  if (status === "loading") {
    if (!loadFailed) return <PageSkeleton />;
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-stone-700">
          Could not load farmers. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="h-12 rounded-xl bg-green-800 px-6 font-semibold text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  const menuItems: MenuItem[] = [
    ...(isAdmin
      ? [
          { label: "Team", onClick: () => setShowTeam(true) },
          { label: "Activity", onClick: () => setShowActivity(true) },
          { label: "Removed farmers", onClick: () => setShowRemoved(true) },
          { label: "Export CSV", onClick: exportCsv },
        ]
      : []),
    { label: leavesOn ? "Turn leaves off" : "Turn leaves on", onClick: () => setLeavesOn(!leavesOn) },
    { label: "Change password", onClick: () => setChangingPassword(true) },
    { label: "Log out", onClick: logout },
  ];

  return (
    <div className="min-h-dvh">
      <AppHeader me={me} items={menuItems} />

      {stats ? (
        <StatsStrip
          stats={stats}
          activeCrop={filters.crop}
          onPickCrop={(crop) => updateFilters({ crop })}
        />
      ) : !statsFailed ? (
        <StatsSkeleton />
      ) : null}

      <FilterBar
        filters={filters}
        onChange={updateFilters}
        onClear={clearFilters}
      />

      {loadFailed && (
        <div
          role="alert"
          className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span>Could not update the list. Showing earlier results.</span>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="h-9 shrink-0 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {!searching && filtersActive && (
        <p role="status" className="px-4 pt-3 text-sm text-stone-600">
          Showing {farmers.length}
          {stats ? ` of ${stats.total}` : ""}{" "}
          {farmers.length === 1 ? "farmer" : "farmers"}
        </p>
      )}

      {searching ? (
        <FarmerListSkeleton />
      ) : farmers.length === 0 ? (
        filtersActive ? (
          <div className="px-6 py-14 text-center text-stone-600">
            <p>No farmers match these filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 h-11 font-semibold text-green-800 underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <p className="px-6 py-14 text-center text-stone-600">
            No farmers yet. Tap &ldquo;+ Add farmer&rdquo; to register the
            first one.
          </p>
        )
      ) : (
        <ul className="grid gap-3 p-4 pb-28 sm:grid-cols-2 lg:grid-cols-3">
          {farmers.map((f) => (
            <FarmerCard
              key={f.id}
              farmer={f}
              onEdit={setEditing}
              onRemove={isAdmin ? setRemoving : undefined}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="fixed right-5 z-30 h-14 rounded-full bg-green-700 px-6 text-base font-semibold text-white shadow-lg"
        style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        + Add farmer
      </button>

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 z-40 -translate-x-1/2 rounded-full bg-stone-900 px-5 py-2 text-sm text-white shadow-lg"
          style={{
            bottom: "calc(max(1.25rem, env(safe-area-inset-bottom)) + 4.5rem)",
          }}
        >
          {toast}
        </div>
      )}

      {adding && (
        <AddFarmerSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setToast("Farmer saved");
            setReloadKey((k) => k + 1);
          }}
          onLoggedOut={() => {
            setAdding(false);
            setStatus("login");
          }}
        />
      )}

      {editing && (
        <AddFarmerSheet
          farmer={editing}
          onClose={() => setEditing(null)}
          onSaved={(_farmer, changed) => {
            setEditing(null);
            setToast(changed === false ? "No changes to save" : "Changes saved");
            setReloadKey((k) => k + 1);
          }}
          onLoggedOut={() => {
            setEditing(null);
            setStatus("login");
          }}
        />
      )}

      {removing && (
        <DeleteFarmerSheet
          farmer={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            setRemoving(null);
            setToast("Farmer removed");
            setReloadKey((k) => k + 1);
          }}
          onLoggedOut={() => {
            setRemoving(null);
            setStatus("login");
          }}
        />
      )}

      {showActivity && (
        <ActivitySheet
          onClose={() => setShowActivity(false)}
          onLoggedOut={() => {
            setShowActivity(false);
            setStatus("login");
          }}
        />
      )}

      {showRemoved && (
        <RemovedSheet
          onClose={() => setShowRemoved(false)}
          onLoggedOut={() => {
            setShowRemoved(false);
            setStatus("login");
          }}
        />
      )}

      {showTeam && me && (
        <TeamSheet
          me={me}
          onClose={() => setShowTeam(false)}
          onLoggedOut={() => {
            setShowTeam(false);
            setStatus("login");
          }}
        />
      )}

      {changingPassword && (
        <ChangePasswordSheet
          forced={false}
          onClose={() => setChangingPassword(false)}
          onLogout={logout}
          onChanged={() => {
            setChangingPassword(false);
            setToast("Password changed");
          }}
        />
      )}
    </div>
  );
}
