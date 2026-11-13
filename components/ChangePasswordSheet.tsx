"use client";

import { useState, type FormEvent } from "react";

const inputClass =
  "h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30 aria-invalid:border-red-600";

export default function ChangePasswordSheet({
  forced,
  onClose,
  onChanged,
  onLogout,
}: {
  forced: boolean; // true = first login with a temporary password, cannot skip
  onClose: () => void;
  onChanged: () => void;
  onLogout: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErrors({});
    setFormError("");
    if (next.length < 10) {
      setErrors({ newPassword: "Use at least 10 characters" });
      return;
    }
    if (next !== again) {
      setErrors({ again: "The two new passwords do not match" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (res.ok) {
        onChanged();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.errors) setErrors(data.errors);
      else setFormError(data.error ?? "Could not change the password. Try again.");
    } catch {
      setFormError("No connection. Nothing was changed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pw-title"
      className="fixed inset-0 z-50 flex flex-col bg-stone-50"
    >
      <header
        className="flex items-center justify-between border-b border-stone-200 bg-white px-4 pb-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <h2 id="pw-title" className="text-lg font-semibold text-stone-900">
          {forced ? "Choose your own password" : "Change password"}
        </h2>
        {forced ? (
          <button
            type="button"
            onClick={onLogout}
            className="h-11 rounded-lg px-3 text-sm font-medium text-stone-700 underline"
          >
            Log out
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-11 w-11 rounded-full text-2xl leading-none text-stone-600"
          >
            &times;
          </button>
        )}
      </header>

      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {forced && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              You are using a temporary password. Choose a new one that only you
              know before you continue.
            </p>
          )}

          <div>
            <label htmlFor="pw-current" className="mb-1 block text-sm font-medium text-stone-700">
              {forced ? "Temporary password" : "Current password"}
            </label>
            <input
              id="pw-current"
              type={show ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              aria-invalid={!!errors.currentPassword}
              className={inputClass}
            />
            {errors.currentPassword && (
              <p className="mt-1 text-sm text-red-700">{errors.currentPassword}</p>
            )}
          </div>

          <div>
            <label htmlFor="pw-new" className="mb-1 block text-sm font-medium text-stone-700">
              New password
            </label>
            <input
              id="pw-new"
              type={show ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              aria-invalid={!!errors.newPassword}
              className={inputClass}
            />
            {errors.newPassword ? (
              <p className="mt-1 text-sm text-red-700">{errors.newPassword}</p>
            ) : (
              <p className="mt-1 text-xs text-stone-500">
                At least 10 characters. A few random words works well.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pw-again" className="mb-1 block text-sm font-medium text-stone-700">
              Type the new password again
            </label>
            <input
              id="pw-again"
              type={show ? "text" : "password"}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              aria-invalid={!!errors.again}
              className={inputClass}
            />
            {errors.again && <p className="mt-1 text-sm text-red-700">{errors.again}</p>}
          </div>

          <label className="flex items-center gap-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="h-5 w-5 accent-green-700"
            />
            Show passwords
          </label>
        </div>

        <div
          className="border-t border-stone-200 bg-white px-4 pt-3"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {formError && (
            <p role="alert" className="mb-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-green-800 text-base font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save new password"}
          </button>
        </div>
      </form>
    </div>
  );
}
