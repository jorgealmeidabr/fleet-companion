import { useNavigate, useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { useChecklistPendente } from "@/hooks/useChecklistPendente";
import { useAuth } from "@/hooks/useAuth";
import { fmtDateTime } from "@/lib/format";

/**
 * Modal global que bloqueia o usuário até preencher o checklist pós-uso.
 * Não bloqueia: rotas /checklists, /meu-perfil, /auth e o Admin.
 */
export function ChecklistPendenteBlock() {
  const { isAdmin } = useAuth();
  const { pendentes, loading } = useChecklistPendente();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading || isAdmin || pendentes.length === 0) return null;

  // Permite acessar a página de checklists e perfil sem bloqueio visual completo
  const allowedPaths = ["/checklists", "/meu-perfil", "/auth"];
  const isOnAllowed = allowedPaths.some(p => location.pathname.startsWith(p));
  if (isOnAllowed) return null;

  return (
    <Dialog open modal>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Checklist pós-uso pendente
          </DialogTitle>
          <DialogDescription>
            Você devolveu {pendentes.length === 1 ? "um veículo" : `${pendentes.length} veículos`} e
            ainda não preencheu o checklist pós-uso. É obrigatório registrá-lo antes
            de continuar a usar o sistema.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {pendentes.map(p => (
            <li key={p.agendamento.id} className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-medium">{p.veiculo_placa}</span>
                <span className="text-xs text-muted-foreground">{p.veiculo_modelo}</span>
              </div>
              {p.agendamento.data_retorno_real && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Devolvido em {fmtDateTime(p.agendamento.data_retorno_real)}
                </p>
              )}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button
            className="w-full bg-gradient-brand text-primary-foreground"
            onClick={() => navigate("/checklists")}
          >
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Preencher checklist agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
