import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// TODO: substituir pela URL real do projeto de rastreamento Lovable
const TRACKING_BASE_URL = "https://rastreamento.lovable.app";

interface Props {
  veiculoId: string | null;
  onClose: () => void;
  onContinue: () => void;
}

export function TrackingQrDialog({ veiculoId, onClose, onContinue }: Props) {
  const open = !!veiculoId;
  const url = veiculoId ? `${TRACKING_BASE_URL}/track/${veiculoId}` : "";

  const handleContinue = () => {
    onContinue();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar localização?</DialogTitle>
          <DialogDescription>
            Escaneie o QR code com o celular para iniciar o rastreamento da sua rota.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-lg bg-white p-4">
              <QRCodeSVG value={url} size={220} level="M" />
            </div>
            <p className="text-sm text-muted-foreground">Escaneie e inicie sua rota</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleContinue}>Recusar</Button>
          <Button variant="brand" onClick={handleContinue}>Já escaneei</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
