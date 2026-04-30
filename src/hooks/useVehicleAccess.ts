import { useCallback, useEffect, useState } from "react";
import {
  canUserUseVehicle,
  getAllRestrictions,
  loadAllRestrictions,
  RestrictionMap,
  VEHICLE_ACCESS_EVENT,
} from "@/lib/vehicleAccess";

export function useVehicleAccess() {
  const [map, setMap] = useState<RestrictionMap>(() => getAllRestrictions());

  useEffect(() => {
    let cancelled = false;
    loadAllRestrictions().then(next => { if (!cancelled) setMap(next); }).catch(() => {});
    const refresh = () => setMap(getAllRestrictions());
    window.addEventListener(VEHICLE_ACCESS_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(VEHICLE_ACCESS_EVENT, refresh);
    };
  }, []);

  const filterAllowed = useCallback(
    <T extends { id: string }>(vehicles: T[], userId: string | null | undefined, isAdmin: boolean): T[] => {
      if (isAdmin) return vehicles;
      return vehicles.filter(v => canUserUseVehicle(v.id, userId, isAdmin, map));
    },
    [map],
  );

  return { restrictions: map, filterAllowed };
}
