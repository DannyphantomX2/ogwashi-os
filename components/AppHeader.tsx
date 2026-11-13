import HeaderMenu, { type MenuItem } from "@/components/HeaderMenu";
import { AdminIcon, AgentIcon } from "@/components/RoleIcons";
import type { Me } from "@/lib/format";

// "Ndabai Daniel" -> "ND", "Daniel" -> "DA"
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

// Agents see a green header with a leaf. Admins see a darker header with a
// gold line and a gold shield, so you can tell at a glance which mode you are in.
export default function AppHeader({
  me,
  items,
}: {
  me: Me | null;
  items: MenuItem[];
}) {
  const admin = me?.role === "admin";

  return (
    <header
      className={`flex items-center justify-between gap-3 border-b-4 px-4 pb-3 text-white ${
        admin ? "border-amber-400 bg-[#0b3d1e]" : "border-green-400 bg-green-800"
      }`}
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            admin ? "bg-amber-400 text-stone-900" : "bg-green-100 text-green-900"
          }`}
        >
          {me ? initials(me.displayName) : ""}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight">
            Ogwashi Farmers
          </h1>
          {me && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-green-100">
              <span className="truncate">{me.displayName}</span>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  admin ? "bg-amber-400 text-stone-900" : "bg-white/20 text-white"
                }`}
              >
                {admin ? (
                  <AdminIcon className="h-3 w-3" />
                ) : (
                  <AgentIcon className="h-3 w-3" />
                )}
                {admin ? "Admin" : "Agent"}
              </span>
            </p>
          )}
        </div>
      </div>
      <HeaderMenu items={items} />
    </header>
  );
}
