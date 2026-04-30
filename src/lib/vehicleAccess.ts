// Restrição de uso de veículos – armazenado em localStorage (cliente apenas).
// Estrutura: { [vehicleId]: { restricted: boolean; allowedUserIds: string[] } }

const STORAGE_KEY = "vehicle_access_v1";
const EVENT_NAME = "vehicle-access-changed";

export interface VehicleRestriction {
  restricted: boolean;
  allowedUserIds: string[];
}

export type RestrictionMap = Record<string, VehicleRestriction>;

function readAll(): RestrictionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed as RestrictionMap : {};
  } catch {
    return {};
  }
}

function writeAll(map: RestrictionMap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch { /* ignore */ }
}

export function getAllRestrictions(): RestrictionMap {
  return readAll();
}

export function getRestriction(vehicleId: string): VehicleRestriction {
  const all = readAll();
  return all[vehicleId] ?? { restricted: false, allowedUserIds: [] };
}

export function setRestriction(vehicleId: string, value: VehicleRestriction) {
  const all = readAll();
  all[vehicleId] = {
    restricted: !!value.restricted,
    allowedUserIds: Array.from(new Set(value.allowedUserIds ?? [])),
  };
  writeAll(all);
}

export function canUserUseVehicle(
  vehicleId: string,
  userId: string | null | undefined,
  isAdmin: boolean,
  map?: RestrictionMap,
): boolean {
  if (isAdmin) return true;
  const r = (map ?? readAll())[vehicleId];
  if (!r || !r.restricted) return true;
  if (!userId) return false;
  return r.allowedUserIds.includes(userId);
}

export const VEHICLE_ACCESS_EVENT = EVENT_NAME;
