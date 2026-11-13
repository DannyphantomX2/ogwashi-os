"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CROPS, VILLAGES } from "@/lib/farmers";
import { cropLabel, formatPhone, type Farmer } from "@/lib/format";

type GpsState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "saved"; lat: number; lng: number } // already stored on the farmer
  | { status: "done"; lat: number; lng: number; accuracy: number }
  | { status: "error"; message: string };

const emptyForm = {
  full_name: "",
  phone: "",
  village: "",
  primary_crop: "",
  farm_size_hectares: "",
};

const inputClass =
  "h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30 aria-invalid:border-red-600";

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-sm font-medium text-stone-700"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-red-700">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

// Adds a new farmer, or edits one when `farmer` is given.
export default function AddFarmerSheet({
  farmer,
  onClose,
  onSaved,
  onLoggedOut,
}: {
  farmer?: Farmer | null;
  onClose: () => void;
  onSaved: (farmer: Farmer, changed?: boolean) => void;
  onLoggedOut: () => void;
}) {
  const [form, setForm] = useState(
    farmer
      ? {
          full_name: farmer.full_name,
          phone: formatPhone(farmer.phone),
          village: farmer.village,
          primary_crop: farmer.primary_crop,
          farm_size_hectares:
            farmer.farm_size_hectares > 0 ? String(farmer.farm_size_hectares) : "",
        }
      : emptyForm
  );
  const [gps, setGps] = useState<GpsState>(
    farmer && farmer.gps_lat !== null && farmer.gps_lng !== null
      ? { status: "saved", lat: farmer.gps_lat, lng: farmer.gps_lng }
      : { status: "idle" }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Stop the page behind the sheet from scrolling
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function captureGps() {
    if (!("geolocation" in navigator)) {
      setGps({
        status: "error",
        message: "This device or browser does not support GPS.",
      });
      return;
    }
    setGps({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({
          status: "done",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Allow location for this site in your browser settings, then try again."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Could not get a location. Move to open ground and try again."
              : "Timed out waiting for GPS. Try again in an open area.";
        setGps({ status: "error", message });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});
    setFormError("");
    try {
      const coords =
        gps.status === "done" || gps.status === "saved"
          ? { lat: gps.lat, lng: gps.lng }
          : null;
      const res = await fetch(farmer ? `/api/farmers/${farmer.id}` : "/api/farmers", {
        method: farmer ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          gps_lat: coords ? coords.lat : null,
          gps_lng: coords ? coords.lng : null,
        }),
      });
      if (res.status === 401) {
        onLoggedOut();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSaved(data.farmer as Farmer, data.changed as boolean | undefined);
        return;
      }
      if (data.errors) {
        setErrors(data.errors);
        setFormError("Please fix the highlighted fields.");
      } else {
        setFormError(data.error ?? "Could not save. Try again.");
      }
    } catch {
      setFormError("No connection. Nothing was saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const hasLocation = gps.status === "done" || gps.status === "saved";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-title"
      className="fixed inset-0 z-50 flex flex-col bg-stone-50"
    >
      <header
        className="flex items-center justify-between border-b border-stone-200 bg-white px-4 pb-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <h2 id="add-title" className="text-lg font-semibold text-stone-900">
          {farmer ? "Edit farmer" : "Add farmer"}
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

      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          <Field label="Full name" htmlFor="full_name" error={errors.full_name}>
            <input
              id="full_name"
              type="text"
              value={form.full_name}
              onChange={(e) => setField("full_name", e.target.value)}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              required
              aria-invalid={!!errors.full_name}
              className={inputClass}
            />
          </Field>

          <Field
            label="Phone (WhatsApp)"
            htmlFor="phone"
            error={errors.phone}
            hint="Nigerian mobile number, e.g. 0801 234 5678"
          >
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              autoComplete="off"
              required
              aria-invalid={!!errors.phone}
              className={inputClass}
            />
          </Field>

          <Field label="Village" htmlFor="village" error={errors.village}>
            <select
              id="village"
              value={form.village}
              onChange={(e) => setField("village", e.target.value)}
              required
              aria-invalid={!!errors.village}
              className={inputClass}
            >
              <option value="" disabled>
                Choose a village
              </option>
              {VILLAGES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Main crop"
            htmlFor="primary_crop"
            error={errors.primary_crop}
          >
            <select
              id="primary_crop"
              value={form.primary_crop}
              onChange={(e) => setField("primary_crop", e.target.value)}
              required
              aria-invalid={!!errors.primary_crop}
              className={inputClass}
            >
              <option value="" disabled>
                Choose a crop
              </option>
              {CROPS.map((c) => (
                <option key={c} value={c}>
                  {cropLabel(c)}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Farm size (hectares)"
            htmlFor="farm_size_hectares"
            error={errors.farm_size_hectares}
            hint="Optional"
          >
            <input
              id="farm_size_hectares"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 2.5"
              value={form.farm_size_hectares}
              onChange={(e) => setField("farm_size_hectares", e.target.value)}
              autoComplete="off"
              aria-invalid={!!errors.farm_size_hectares}
              className={inputClass}
            />
          </Field>

          <div className="rounded-xl border border-stone-300 bg-white p-4">
            <p className="text-sm font-medium text-stone-700">
              Farm location (GPS)
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Optional. Tap this while standing at the farm.
            </p>

            {gps.status === "saved" && (
              <div className="mt-3 text-sm text-green-800">
                <p>
                  Saved location: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Only retake it if you are at the farm and want to replace it.
                </p>
              </div>
            )}
            {gps.status === "done" && (
              <div className="mt-3 text-sm text-green-800">
                <p>
                  Captured: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                </p>
                <p>Accuracy: about {Math.round(gps.accuracy)} m</p>
                {gps.accuracy > 100 && (
                  <p className="mt-1 text-amber-700">
                    Weak signal. Move to open ground and retake for a better
                    reading.
                  </p>
                )}
              </div>
            )}
            {gps.status === "error" && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {gps.message}
              </p>
            )}
            {errors.gps && (
              <p className="mt-3 text-sm text-red-700">{errors.gps}</p>
            )}

            <button
              type="button"
              onClick={captureGps}
              disabled={gps.status === "locating"}
              className="mt-3 h-12 w-full rounded-xl border border-green-800 text-base font-semibold text-green-800 disabled:opacity-60"
            >
              {gps.status === "locating"
                ? "Getting location..."
                : hasLocation
                  ? "Retake location"
                  : "Capture location"}
            </button>
          </div>
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
            disabled={saving}
            className="h-12 w-full rounded-xl bg-green-800 text-base font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : farmer ? "Save changes" : "Save farmer"}
          </button>
        </div>
      </form>
    </div>
  );
}
