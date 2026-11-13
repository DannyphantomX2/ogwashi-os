"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminIcon, AgentIcon } from "@/components/RoleIcons";

type Portal = "agent" | "admin";

const PORTALS: { id: Portal; label: string; blurb: string }[] = [
  {
    id: "agent",
    label: "Agent",
    blurb: "Register farmers and look up records.",
  },
  {
    id: "admin",
    label: "Admin",
    blurb: "Everything agents can do, plus removing farmers and exporting data.",
  },
];

const inputClass =
  "h-12 w-full rounded-xl border border-[#dde3ee] bg-[#e8f0fe] px-4 text-base text-black focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30";

export default function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [portal, setPortal] = useState<Portal>("agent");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const current = PORTALS.find((p) => p.id === portal) ?? PORTALS[0];

  // Wake the database while the person is typing, so the first login is not slow
  useEffect(() => {
    fetch("/api/warm", { cache: "no-store" }).catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, as: portal }),
        });
        if (res.ok) {
          onSuccess();
          return;
        }
        const data = await res.json().catch(() => ({}));
        // The database was asleep and had not woken up yet: wait and try once more
        if (res.status === 503 && attempt === 0) {
          setNotice("Waking up the database, one moment...");
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }
        // Right password, wrong door: switch to the correct tab for them
        if (res.status === 403 && (data.role === "admin" || data.role === "agent")) {
          setPortal(data.role);
        }
        setError(data.error ?? "Could not log in. Try again.");
        return;
      }
    } catch {
      setError("No connection. Check your network and try again.");
    } finally {
      setNotice("");
      setBusy(false);
    }
  }

  return (
    <main className="login-bg flex min-h-dvh items-center justify-center px-5 py-8">
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.22)] lg:[zoom:1.083]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background:
              portal === "admin"
                ? "linear-gradient(to right, #fcd34d, #d97706)"
                : "linear-gradient(to right, #4ade80, #15803d)",
          }}
        />
        <h1 className="text-2xl font-bold text-green-800">Ogwashi Farmers</h1>

        <div
          role="group"
          aria-label="Login type"
          className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-[#f4f2f4] p-1"
        >
          {PORTALS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={portal === p.id}
              onClick={() => {
                setPortal(p.id);
                setError("");
              }}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold ${
                portal === p.id
                  ? "bg-white text-black shadow-sm"
                  : "text-stone-700"
              }`}
            >
              {p.id === "admin" ? (
                <AdminIcon
                  className={`h-4 w-4 ${portal === p.id ? "text-amber-600" : "text-stone-500"}`}
                />
              ) : (
                <AgentIcon
                  className={`h-4 w-4 ${portal === p.id ? "text-green-700" : "text-stone-500"}`}
                />
              )}
              {p.label} login
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-600">{current.blurb}</p>

        <label
          htmlFor="username"
          className="mt-5 block text-sm font-semibold text-stone-800"
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          required
          className={`mt-1 ${inputClass}`}
        />

        <label
          htmlFor="password"
          className="mt-4 block text-sm font-semibold text-stone-800"
        >
          Password
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className={`min-w-0 flex-1 ${inputClass}`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="h-12 rounded-xl border border-[#e3e3e3] bg-white px-4 text-sm font-semibold text-stone-800"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>

        {notice && (
          <p role="status" className="mt-3 text-sm text-stone-600">
            {notice}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || username.length === 0 || password.length === 0}
          className={`mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white disabled:opacity-60 ${
            portal === "admin" ? "bg-stone-900" : "bg-green-800"
          }`}
        >
          {portal === "admin" ? (
            <AdminIcon className="h-5 w-5 text-amber-300" />
          ) : (
            <AgentIcon className="h-5 w-5 text-green-200" />
          )}
          {busy ? "Checking..." : `Log in as ${current.label.toLowerCase()}`}
        </button>
      </form>
    </main>
  );
}
