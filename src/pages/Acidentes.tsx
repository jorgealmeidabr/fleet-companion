import { usePermissions } from "@/hooks/usePermissions";
import AcidentesUsuario from "./AcidentesUsuario";
import AcidentesAdminList from "./AcidentesAdminList";

export default function Acidentes() {
  const { isAdmin } = usePermissions();
  return isAdmin ? <AcidentesAdminList /> : <AcidentesUsuario />;
}
