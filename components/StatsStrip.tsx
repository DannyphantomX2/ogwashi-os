import { cropLabel, type Stats } from "@/lib/format";

const fmt = (n: number) =>
  n.toLocaleString("en-NG", { maximumFractionDigits: 1 });

export default function StatsStrip({
  stats,
  activeCrop,
  onPickCrop,
}: {
  stats: Stats;
  activeCrop: string;
  onPickCrop: (crop: string) => void;
}) {
  return (
    <section aria-label="Summary" className="bg-white px-4 pb-3 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-green-50 p-3">
          <p className="text-xs font-medium text-green-900">Farmers</p>
          <p className="text-2xl font-bold text-green-950">{fmt(stats.total)}</p>
        </div>
        <div className="rounded-xl bg-green-50 p-3">
          <p className="text-xs font-medium text-green-900">Total hectares</p>
          <p className="text-2xl font-bold text-green-950">
            {fmt(stats.total_hectares)}
          </p>
        </div>
      </div>

      {stats.by_crop.length > 0 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {stats.by_crop.map((c) => {
            const on = activeCrop === c.primary_crop;
            return (
              <button
                key={c.primary_crop}
                type="button"
                aria-pressed={on}
                onClick={() => onPickCrop(on ? "" : c.primary_crop)}
                className={`flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
                  on
                    ? "border-green-800 bg-green-800 text-white"
                    : "border-stone-300 bg-white text-stone-800"
                }`}
              >
                {cropLabel(c.primary_crop)} &middot; {c.farmers}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
