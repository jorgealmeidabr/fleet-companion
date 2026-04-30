import { useCallback, useEffect, useState } from "react";
import {
  canUserUseVehicle,
  getAllRestrictions,
  RestrictionMap,
  VEHICLE_ACCESS_EVENT,
} from "@/lib/vehicleAccess";

export function useVehicleAccess() {
  const [map, setMap] = useState<RestrictionMap>(() => getAllRestrictions());

  useEffect(() => {
    const refresh = () => setMap(getAllRestrictions());
    window.addEventListener(VEHICLE_ACCESS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(VEHICLE_ACCESS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
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
