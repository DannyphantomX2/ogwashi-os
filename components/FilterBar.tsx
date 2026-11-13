"use client";

import { CROPS, VILLAGES } from "@/lib/farmers";
import { cropLabel } from "@/lib/format";

export type Filters = { q: string; village: string; crop: string };

const selectClass =
  "h-11 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30";

export default function FilterBar({
  filters,
  onChange,
  onClear,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}) {
  const active = filters.q !== "" || filters.village !== "" || filters.crop !== "";

  return (
    <div className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        aria-label="Search farmers"
        placeholder="Search name, village or phone"
        autoComplete="off"
        value={filters.q}
        onChange={(e) => onChange({ q: e.target.value })}
        className="h-11 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30"
      />
      <div className="mt-2 flex gap-2">
        <select
          aria-label="Filter by village"
          value={filters.village}
          onChange={(e) => onChange({ village: e.target.value })}
          className={selectClass}
        >
          <option value="">All villages</option>
          {VILLAGES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by crop"
          value={filters.crop}
          onChange={(e) => onChange({ crop: e.target.value })}
          className={selectClass}
        >
          <option value="">All crops</option>
          {CROPS.map((c) => (
            <option key={c} value={c}>
              {cropLabel(c)}
            </option>
          ))}
        </select>
        {active && (
          <button
            type="button"
            onClick={onClear}
            className="h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-green-800 underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
