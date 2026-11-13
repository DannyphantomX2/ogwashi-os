"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DELETE_REASONS } from "@/lib/farmers";
import type { Farmer } from "@/lib/format";

export default function DeleteFarmerSheet({
  farmer,
  onClose,
  onRemoved,
  onLoggedOut,
}: {
  farmer: Farmer;
  onClose: () => void;
  onRemoved: () => void;
  onLoggedOut: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !reason) return;
    setBusy(true);
    setErrors({});
    setFormError("");
    try {
      const res = await fetch(`/api/farmers/${farmer.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, note }),
      });
      if (res.status === 401) {
        onLoggedOut();
        return;
      }
      // 404 means the farmer is already gone, which is the result we wanted
      if (res.ok || res.status === 404) {
        onRemoved();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.errors) setErrors(data.errors);
      else setFormError(data.error ?? "Could not remove. Try again.");
    } catch {
      setFormError("No connection. Nothing was removed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <form
        onSubmit={submit}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-5 pt-5 sm:rounded-2xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <h2 id="remove-title" className="text-lg font-semibold text-stone-900">
          Remove {farmer.full_name}?
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          This permanently deletes their name, phone number and location. Only
          the reason is kept, without any personal details.
        </p>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-stone-700">
            Why are you removing this farmer?
          </legend>
          <div className="mt-2 space-y-2">
            {DELETE_REASONS.map((r) => (
              <label
                key={r}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-stone-300 px-4 text-base has-[:checked]:border-red-600 has-[:checked]:bg-red-50"
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => {
                    setReason(r);
                    setErrors({});
                  }}
                  className="h-5 w-5 accent-red-700"
                />
                {r}
              </label>
            ))}
          </div>
          {errors.reason && (
            <p className="mt-1 text-sm text-red-700">{errors.reason}</p>
          )}
        </fieldset>

        <label
          htmlFor="remove-note"
          className="mt-4 block text-sm font-medium text-stone-700"
        >
          Note {reason === "Other" ? "(required)" : "(optional)"}
        </label>
        <textarea
          id="remove-note"
          rows={3}
          maxLength={200}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setErrors({});
          }}
          aria-invalid={!!errors.note}
          className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30 aria-invalid:border-red-600"
        />
        {errors.note ? (
          <p className="mt-1 text-sm text-red-700">{errors.note}</p>
        ) : (
          <p className="mt-1 text-xs text-stone-500">
            Do not write phone numbers or other personal details here.
          </p>
        )}

        {formError && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {formError}
          </p>
        )}

        <div className="mt-5 space-y-2">
          <button
            type="submit"
            disabled={busy || !reason}
            className="h-12 w-full rounded-xl bg-red-700 text-base font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Removing..." : "Remove farmer"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-12 w-full rounded-xl border border-stone-300 text-base font-medium text-stone-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
