// Restrição de uso de veículos – persistido no Supabase.
// Tabela: vehicle_allowed_users (vehicle_id, user_id)
// Coluna: veiculos.restricted (boolean)
// Mantém um cache em memória + emite evento para hooks reagirem.

import { supabase } from "@/lib/supabase";

const EVENT_NAME = "vehicle-access-changed";

export interface VehicleRestriction {
  restricted: boolean;
  allowedUserIds: string[];
}

export type RestrictionMap = Record<string, VehicleRestriction>;

let cache: RestrictionMap = {};
let loadedOnce = false;
let inflight: Promise<RestrictionMap> | null = null;

function emit() {
  try { window.dispatchEvent(new CustomEvent(EVENT_NAME)); } catch { /* ignore */ }
}

/** Carrega TODAS as restrições + relações allowed do banco. Cacheado. */
export async function loadAllRestrictions(force = false): Promise<RestrictionMap> {
  if (!force && loadedOnce) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const next: RestrictionMap = {};

    const [{ data: vs }, { data: rels }] = await Promise.all([
      (supabase as any).from("veiculos").select("id, restricted"),
      (supabase as any).from("vehicle_allowed_users").select("vehicle_id, user_id"),
    ]);

    for (const v of (vs ?? []) as Array<{ id: string; restricted: boolean | null }>) {
      next[v.id] = { restricted: !!v.restricted, allowedUserIds: [] };
    }
    for (const r of (rels ?? []) as Array<{ vehicle_id: string; user_id: string }>) {
      const cur = next[r.vehicle_id] ?? { restricted: false, allowedUserIds: [] };
      cur.allowedUserIds.push(r.user_id);
      next[r.vehicle_id] = cur;
    }

    cache = next;
    loadedOnce = true;
    emit();
    return next;
  })();
  try { return await inflight; }
  finally { inflight = null; }
}

export function getAllRestrictions(): RestrictionMap {
  // Dispara carga em background na primeira leitura.
  if (!loadedOnce && !inflight) { loadAllRestrictions().catch(() => {}); }
  return cache;
}

export async function getRestriction(vehicleId: string): Promise<VehicleRestriction> {
  const all = await loadAllRestrictions();
  return all[vehicleId] ?? { restricted: false, allowedUserIds: [] };
}

/** Persiste restrição: atualiza coluna + sincroniza vehicle_allowed_users. */
export async function setRestriction(vehicleId: string, value: VehicleRestriction): Promise<void> {
  const restricted = !!value.restricted;
  const desired = Array.from(new Set(value.allowedUserIds ?? []));

  // 1. Atualiza flag
  const { error: upErr } = await (supabase as any)
    .from("veiculos")
    .update({ restricted })
    .eq("id", vehicleId);
  if (upErr) throw upErr;

  // 2. Sincroniza relações (diff)
  const { data: existingRows, error: selErr } = await (supabase as any)
    .from("vehicle_allowed_users")
    .select("user_id")
    .eq("vehicle_id", vehicleId);
  if (selErr) throw selErr;
  const existing = new Set(((existingRows ?? []) as Array<{ user_id: string }>).map(r => r.user_id));
  const desiredSet = new Set(desired);

  const toInsert = desired.filter(u => !existing.has(u));
  const toDelete = Array.from(existing).filter(u => !desiredSet.has(u));

  if (toInsert.length) {
    const { error } = await (supabase as any)
      .from("vehicle_allowed_users")
      .insert(toInsert.map(user_id => ({ vehicle_id: vehicleId, user_id })));
    if (error) throw error;
  }
  if (toDelete.length) {
    const { error } = await (supabase as any)
      .from("vehicle_allowed_users")
      .delete()
      .eq("vehicle_id", vehicleId)
      .in("user_id", toDelete);
    if (error) throw error;
  }

  // 3. Atualiza cache local
  cache = { ...cache, [vehicleId]: { restricted, allowedUserIds: desired } };
  emit();
}

export function canUserUseVehicle(
  vehicleId: string,
  userId: string | null | undefined,
  isAdmin: boolean,
  map?: RestrictionMap,
): boolean {
  if (isAdmin) return true;
  const r = (map ?? cache)[vehicleId];
  if (!r || !r.restricted) return true;
  if (!userId) return false;
  return r.allowedUserIds.includes(userId);
}

export const VEHICLE_ACCESS_EVENT = EVENT_NAME;
