import { cropLabel, formatPhone, type Farmer } from "@/lib/format";

const actionBase =
  "flex h-11 items-center justify-center rounded-xl text-sm font-semibold";

export default function FarmerCard({
  farmer,
  onEdit,
  onRemove,
}: {
  farmer: Farmer;
  onEdit?: (farmer: Farmer) => void; // agents and admins
  onRemove?: (farmer: Farmer) => void; // admins only
}) {
  const hasGps = farmer.gps_lat !== null && farmer.gps_lng !== null;

  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-stone-900">
            {farmer.full_name}
          </h2>
          <p className="text-sm text-stone-600">{farmer.village}</p>
        </div>
        <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-900">
          {cropLabel(farmer.primary_crop)}
        </span>
      </div>

      <dl className="mt-3 flex gap-8 text-sm">
        <div>
          <dt className="text-stone-500">Phone</dt>
          <dd className="font-medium">{formatPhone(farmer.phone)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Farm size</dt>
          <dd className="font-medium">
            {farmer.farm_size_hectares > 0
              ? `${farmer.farm_size_hectares} ha`
              : "Not set"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <a
          href={`https://wa.me/${farmer.phone}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${actionBase} bg-green-700 text-white`}
        >
          WhatsApp
        </a>
        <a
          href={`tel:+${farmer.phone}`}
          className={`${actionBase} border border-stone-300 text-stone-800`}
        >
          Call
        </a>
        {hasGps ? (
          <a
            href={`https://www.google.com/maps?q=${farmer.gps_lat},${farmer.gps_lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${actionBase} border border-stone-300 text-stone-800`}
          >
            Map
          </a>
        ) : (
          <span
            className={`${actionBase} border border-dashed border-stone-300 font-normal text-stone-400`}
          >
            No GPS
          </span>
        )}
      </div>

      {(onEdit || onRemove) && (
        <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(farmer)}
              aria-label={`Edit ${farmer.full_name}`}
              className="h-11 rounded-lg px-3 text-sm font-semibold text-green-800"
            >
              Edit
            </button>
          ) : (
            <span />
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(farmer)}
              aria-label={`Remove ${farmer.full_name}`}
              className="h-11 rounded-lg px-3 text-sm font-medium text-red-700"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </li>
  );
}
