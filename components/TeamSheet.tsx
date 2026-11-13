"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Me, TeamMember } from "@/lib/format";

type Secret = {
  name: string;
  username: string;
  password: string;
  kind: "created" | "reset";
};

const inputClass =
  "h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30 aria-invalid:border-red-600";

const ROLE_OPTIONS = [
  { id: "agent", label: "Agent", blurb: "Registers farmers and looks up records." },
  {
    id: "admin",
    label: "Admin",
    blurb: "Also removes farmers, exports data and manages the team.",
  },
] as const;

function when(iso: string | null): string {
  if (!iso) return "Never logged in";
  return `Last login: ${new Date(iso).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function SecretPanel({
  secret,
  onDone,
}: {
  secret: Secret;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
      <p className="font-semibold text-stone-900">
        {secret.kind === "created"
          ? `Account created for ${secret.name}`
          : `New temporary password for ${secret.name}`}
      </p>
      <p className="mt-1 text-sm text-stone-700">
        Username: <span className="font-semibold">{secret.username}</span>
      </p>
      <code className="mt-3 block select-all break-all rounded-xl bg-stone-900 px-4 py-3 text-center font-mono text-xl tracking-wider text-white">
        {secret.password}
      </code>
      <p className="mt-3 text-sm text-stone-700">
        Give this to them privately. <strong>It is shown only once.</strong> They
        will be asked to choose their own password when they first log in.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copy}
          className="h-12 rounded-xl border border-stone-400 bg-white text-base font-semibold text-stone-900"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-12 rounded-xl bg-stone-900 text-base font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function AddPersonForm({
  onCreated,
  onCancel,
  onLoggedOut,
}: {
  onCreated: (secret: Secret) => void;
  onCancel: () => void;
  onLoggedOut: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"agent" | "admin">("agent");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, role }),
      });
      if (res.status === 401) {
        onLoggedOut();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onCreated({
          name: data.user.display_name,
          username: data.user.username,
          password: data.temporaryPassword,
          kind: "created",
        });
        return;
      }
      if (data.errors) {
        setErrors(data.errors);
        setFormError("Please fix the highlighted fields.");
      } else {
        setFormError(data.error ?? "Could not create the account. Try again.");
      }
    } catch {
      setFormError("No connection. Nothing was created. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
      <h3 className="font-semibold text-stone-900">Add a person</h3>

      <div>
        <label htmlFor="team-name" className="mb-1 block text-sm font-medium text-stone-700">
          Full name
        </label>
        <input
          id="team-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          required
          aria-invalid={!!errors.displayName}
          className={inputClass}
        />
        {errors.displayName && <p className="mt-1 text-sm text-red-700">{errors.displayName}</p>}
      </div>

      <div>
        <label htmlFor="team-username" className="mb-1 block text-sm font-medium text-stone-700">
          Username
        </label>
        <input
          id="team-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-invalid={!!errors.username}
          className={inputClass}
        />
        {errors.username ? (
          <p className="mt-1 text-sm text-red-700">{errors.username}</p>
        ) : (
          <p className="mt-1 text-xs text-stone-500">
            Lowercase letters, numbers, dot, dash or underscore. They type this to log in.
          </p>
        )}
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-stone-700">Role</legend>
        <div className="space-y-2">
          {ROLE_OPTIONS.map((r) => (
            <label
              key={r.id}
              className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-stone-300 px-4 py-3 has-[:checked]:border-green-700 has-[:checked]:bg-green-50"
            >
              <input
                type="radio"
                name="team-role"
                value={r.id}
                checked={role === r.id}
                onChange={() => setRole(r.id)}
                className="mt-1 h-5 w-5 accent-green-700"
              />
              <span>
                <span className="block text-base font-medium text-stone-900">{r.label}</span>
                <span className="block text-sm text-stone-600">{r.blurb}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.role && <p className="mt-1 text-sm text-red-700">{errors.role}</p>}
      </fieldset>

      {formError && (
        <p role="alert" className="text-sm text-red-700">
          {formError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-12 rounded-xl border border-stone-300 text-base font-medium text-stone-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="h-12 rounded-xl bg-green-800 text-base font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Creating..." : "Create account"}
        </button>
      </div>
    </form>
  );
}

export default function TeamSheet({
  me,
  onClose,
  onLoggedOut,
}: {
  me: Me;
  onClose: () => void;
  onLoggedOut: () => void;
}) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  useEffect(() => {
    const controller = new AbortController();
    async function run() {
      try {
        const res = await fetch("/api/users", { signal: controller.signal });
        if (res.status === 401) {
          loggedOutRef.current();
          return;
        }
        if (!res.ok) throw new Error("Bad response");
        const data = await res.json();
        setMembers(data.users);
        setLoadError("");
      } catch {
        if (!controller.signal.aborted) {
          setLoadError("Could not load the team. Check your connection and try again.");
        }
      }
    }
    void run();
    return () => controller.abort();
  }, [reloadKey]);

  async function act(
    member: TeamMember,
    action: "disable" | "enable" | "reset_password"
  ) {
    if (
      action === "disable" &&
      !confirm(`Disable ${member.display_name}? They will be logged out straight away.`)
    ) {
      return;
    }
    if (
      action === "reset_password" &&
      !confirm(`Reset the password for ${member.display_name}? Their current password stops working.`)
    ) {
      return;
    }
    setBusyId(member.id);
    setMessage("");
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.status === 401) {
        onLoggedOut();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "That did not work. Try again.");
        return;
      }
      if (action === "reset_password") {
        setSecret({
          name: member.display_name,
          username: member.username,
          password: data.temporaryPassword,
          kind: "reset",
        });
      }
      setReloadKey((k) => k + 1);
    } catch {
      setMessage("No connection. Nothing was changed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-title"
      className="fixed inset-0 z-50 flex flex-col bg-stone-50"
    >
      <header
        className="flex items-center justify-between border-b border-stone-200 bg-white px-4 pb-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <h2 id="team-title" className="text-lg font-semibold text-stone-900">
          Team
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

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 pb-10">
        {secret && <SecretPanel secret={secret} onDone={() => setSecret(null)} />}

        {adding ? (
          <AddPersonForm
            onCancel={() => setAdding(false)}
            onLoggedOut={onLoggedOut}
            onCreated={(s) => {
              setAdding(false);
              setSecret(s);
              setReloadKey((k) => k + 1);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setSecret(null);
              setAdding(true);
            }}
            className="h-12 w-full rounded-xl bg-green-800 text-base font-semibold text-white"
          >
            + Add a person
          </button>
        )}

        {message && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {message}
          </p>
        )}

        {loadError ? (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-2 h-10 font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : members === null ? (
          <div role="status" aria-label="Loading team" className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className="h-28 rounded-2xl bg-stone-200 motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {members.map((m) => {
              const isMe = m.id === me.id;
              return (
                <li key={m.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-stone-900">
                        {m.display_name}
                        {isMe && (
                          <span className="ml-2 text-xs font-medium text-stone-500">(you)</span>
                        )}
                      </p>
                      <p className="truncate text-sm text-stone-600">{m.username}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        m.role === "admin"
                          ? "bg-stone-900 text-white"
                          : "bg-green-100 text-green-900"
                      }`}
                    >
                      {m.role === "admin" ? "Admin" : "Agent"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    {!m.active
                      ? "Disabled"
                      : m.must_change_password
                        ? "Waiting for first login"
                        : "Active"}{" "}
                    &middot; {when(m.last_login)}
                  </p>
                  {!isMe && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => act(m, m.active ? "disable" : "enable")}
                        className="h-11 rounded-xl border border-stone-300 text-sm font-semibold text-stone-800 disabled:opacity-60"
                      >
                        {m.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => act(m, "reset_password")}
                        className="h-11 rounded-xl border border-stone-300 text-sm font-semibold text-stone-800 disabled:opacity-60"
                      >
                        Reset password
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
