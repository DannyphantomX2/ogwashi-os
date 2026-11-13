export const VILLAGES = [
  "Ogwashi-Uku",
  "Azagba",
  "Otulu",
  "Olukwu",
  "Aboh-Ogwashi",
  "Other",
] as const;

export const CROPS = ["maize", "palm kernel", "pkc", "cassava", "soy"] as const;

export type FarmerInput = {
  full_name: string;
  phone: string;
  village: (typeof VILLAGES)[number];
  primary_crop: (typeof CROPS)[number];
  farm_size_hectares: number;
  gps_lat: number | null;
  gps_lng: number | null;
};

// Turns 0801 234 5678, +234 801 234 5678, 8012345678 etc. into 2348012345678
export function normalizeNigerianPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^2340[789]\d{9}$/.test(d)) d = "234" + d.slice(4);
  if (/^234[789]\d{9}$/.test(d)) return d;
  if (/^0[789]\d{9}$/.test(d)) return "234" + d.slice(1);
  if (/^[789]\d{9}$/.test(d)) return "234" + d;
  return null;
}

type Result =
  | { ok: true; data: FarmerInput }
  | { ok: false; errors: Record<string, string> };

export function validateFarmer(body: unknown): Result {
  const errors: Record<string, string> = {};
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;

  const full_name =
    typeof b.full_name === "string"
      ? b.full_name.trim().replace(/\s+/g, " ")
      : "";
  if (full_name.length < 2 || full_name.length > 100) {
    errors.full_name = "Enter the full name (2 to 100 characters)";
  }

  const phone =
    typeof b.phone === "string" ? normalizeNigerianPhone(b.phone) : null;
  if (!phone) {
    errors.phone = "Enter a valid Nigerian mobile number, e.g. 0801 234 5678";
  }

  const village = VILLAGES.find((v) => v === b.village);
  if (!village) errors.village = "Choose a village from the list";

  const primary_crop = CROPS.find((c) => c === b.primary_crop);
  if (!primary_crop) errors.primary_crop = "Choose a crop from the list";

  const sizeRaw = b.farm_size_hectares;
  const size = sizeRaw === "" || sizeRaw == null ? 0 : Number(sizeRaw);
  if (!Number.isFinite(size) || size < 0 || size > 10000) {
    errors.farm_size_hectares = "Farm size must be between 0 and 10,000";
  }

  const hasLat = b.gps_lat != null && b.gps_lat !== "";
  const hasLng = b.gps_lng != null && b.gps_lng !== "";
  let gps_lat: number | null = null;
  let gps_lng: number | null = null;
  if (hasLat || hasLng) {
    const lat = Number(b.gps_lat);
    const lng = Number(b.gps_lng);
    if (
      !hasLat ||
      !hasLng ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      errors.gps = "GPS location is not valid";
    } else {
      gps_lat = lat;
      gps_lng = lng;
    }
  }

  if (Object.keys(errors).length > 0 || !phone || !village || !primary_crop) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      full_name,
      phone,
      village,
      primary_crop,
      farm_size_hectares: size,
      gps_lat,
      gps_lng,
    },
  };
}

export const DELETE_REASONS = [
  "Duplicate entry",
  "Entered by mistake",
  "Farmer asked to be removed",
  "Moved away or stopped farming",
  "Other",
] as const;
