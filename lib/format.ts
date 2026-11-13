export type Farmer = {
  id: string;
  full_name: string;
  phone: string;
  village: string;
  primary_crop: string;
  farm_size_hectares: number;
  gps_lat: number | null;
  gps_lng: number | null;
  created_at: string;
};

// 2348012345678 -> 0801 234 5678
export function formatPhone(p: string): string {
  const local = p.startsWith("234") ? "0" + p.slice(3) : p;
  return local.replace(/^(\d{4})(\d{3})(\d{4})$/, "$1 $2 $3");
}

export function cropLabel(c: string): string {
  return c === "pkc" ? "PKC" : c.charAt(0).toUpperCase() + c.slice(1);
}

export type Stats = {
  total: number;
  total_hectares: number;
  by_crop: { primary_crop: string; farmers: number; hectares: number }[];
  by_village: { village: string; farmers: number; hectares: number }[];
};

export type Me = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "agent";
  mustChangePassword: boolean;
};

export type TeamMember = {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "agent";
  active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login: string | null;
};

export type ActivityEntry = {
  id: string;
  at: string;
  username: string | null;
  display_name: string | null;
  action: string;
  farmer_id: string | null;
  ip: string | null;
  details: Record<string, unknown>;
};

export type RemovedEntry = {
  id: string;
  farmer_id: string;
  village: string;
  primary_crop: string;
  farm_size_hectares: number;
  farmer_created_at: string;
  reason: string;
  note: string | null;
  deleted_at: string;
  removed_by: string | null;
};
