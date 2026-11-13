import { cropLabel, type ActivityEntry } from "@/lib/format";

export type Tone = "good" | "warn" | "bad" | "neutral";

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  phone: "phone number",
  village: "village",
  crop: "main crop",
  farm_size: "farm size",
  gps: "GPS location",
};

const text = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";

function change(v: unknown, label: string, fmt = (s: string) => s): string | null {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `${label}: ${fmt(text(o.from))} \u2192 ${fmt(text(o.to))}`;
  }
  return null;
}

function whoIs(e: ActivityEntry): string {
  if (e.username === "unknown (before logging)") return "Someone";
  if (e.username === "terminal") return "The terminal";
  return e.display_name || e.username || "Someone";
}

// Turns a log row into a plain sentence. Names and phone numbers are never
// stored in the log, so none can appear here.
export function describe(e: ActivityEntry): {
  text: string;
  extra?: string;
  tone: Tone;
} {
  const d = (e.details ?? {}) as Record<string, unknown>;
  const who = whoIs(e);
  const old = d.backfilled === true ? "Recorded before logging began." : undefined;

  switch (e.action) {
    case "login.success":
      return { text: `${who} logged in`, tone: "good" };
    case "logout":
      return { text: `${who} logged out`, tone: "neutral" };
    case "login.failed": {
      const reason = text(d.reason);
      return {
        text: `Failed login${e.username ? ` for ${e.username}` : ""}`,
        extra: reason ? `Reason: ${reason}` : undefined,
        tone: "warn",
      };
    }
    case "login.locked":
      return {
        text: e.username
          ? `Login for ${e.username} locked after too many failed attempts`
          : "A device was locked out after too many failed logins",
        extra: "Locked for 15 minutes",
        tone: "bad",
      };
    case "login.wrong_portal":
      return {
        text: `${who} used the ${text(d.tried)} tab with ${
          text(d.role) === "admin" ? "an admin" : "an agent"
        } account`,
        extra: "Right password, wrong tab. They were not logged in.",
        tone: "neutral",
      };
    case "farmer.create": {
      const bits = [
        text(d.village),
        d.crop ? cropLabel(text(d.crop)) : "",
        Number(d.farm_size_hectares) > 0 ? `${text(d.farm_size_hectares)} ha` : "",
      ].filter(Boolean);
      return {
        text: old ? "A farmer was registered" : `${who} added a farmer`,
        extra: [bits.join(", "), old].filter(Boolean).join(". "),
        tone: "good",
      };
    }
    case "farmer.update": {
      const fields = Array.isArray(d.fields) ? (d.fields as unknown[]) : [];
      const labels = fields.map((f) => FIELD_LABELS[text(f)] ?? text(f));
      const lines = [
        change(d.village, "Village"),
        change(d.crop, "Crop", cropLabel),
        change(d.farm_size, "Farm size", (s) => `${s} ha`),
      ].filter(Boolean);
      return {
        text: `${who} edited a farmer${labels.length ? `: ${labels.join(", ")}` : ""}`,
        extra: lines.length ? lines.join(" \u00b7 ") : undefined,
        tone: "neutral",
      };
    }
    case "farmer.remove": {
      const note = text(d.note);
      const where = [text(d.village), d.crop ? cropLabel(text(d.crop)) : ""]
        .filter(Boolean)
        .join(", ");
      return {
        text: old ? "A farmer was removed" : `${who} removed a farmer`,
        extra: [`Reason: ${text(d.reason)}${note ? ` (\u201c${note}\u201d)` : ""}`, where, old]
          .filter(Boolean)
          .join(". "),
        tone: "bad",
      };
    }
    case "export.csv":
      return {
        text: `${who} exported the farmer list to CSV`,
        extra: d.rows !== undefined ? `${text(d.rows)} farmers in the file` : undefined,
        tone: "warn",
      };
    case "access.denied":
      return {
        text: `${who} was blocked from an admin-only action`,
        extra: `${text(d.method)} ${text(d.path)}`.trim(),
        tone: "bad",
      };
    case "user.create":
      return {
        text: `${who} created the account ${text(d.target || d.user)}`,
        extra: d.role ? `Role: ${text(d.role)}` : undefined,
        tone: "neutral",
      };
    case "user.disable":
      return { text: `${who} disabled ${text(d.target || d.user)}`, tone: "warn" };
    case "user.enable":
      return { text: `${who} re-enabled ${text(d.target || d.user)}`, tone: "neutral" };
    case "user.password_reset":
      return {
        text: `${who} reset the password for ${text(d.target || d.user)}`,
        tone: "warn",
      };
    case "user.password_change":
      return d.by === "self"
        ? { text: `${who} changed their own password`, tone: "neutral" }
        : { text: `${who} changed the password for ${text(d.user)}`, tone: "neutral" };
    case "password.change_failed":
      return {
        text: `${who} entered a wrong current password while changing their password`,
        tone: "warn",
      };
    default:
      return { text: `${who}: ${e.action}`, tone: "neutral" };
  }
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
