import { useAuth } from "@/hooks/useAuth";
import brqLogo from "@/assets/brq-logo-frota.png";
import { Clock, XCircle } from "lucide-react";

export default function PendingApproval({ status }: { status: "pendente" | "rejeitado" }) {
  const { signOut } = useAuth();
  const isRejected = status === "rejeitado";

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <img src={brqLogo} alt="BRQ Frota Interna" className="w-44 mx-auto" />

        <div
          className={`rounded-xl border p-8 backdrop-blur-sm space-y-4 animate-in fade-in slide-in-from-bottom-4 ${
            isRejected
              ? "bg-destructive/10 border-destructive/40"
              : "bg-warning/10 border-warning/40"
          }`}
        >
          {isRejected ? (
            <XCircle className="mx-auto h-14 w-14 text-destructive" />
          ) : (
            <Clock className="mx-auto h-14 w-14 text-warning" />
          )}

          <h1 className="text-xl font-bold text-foreground">
            {isRejected ? "Acesso negado" : "Aguardando aprovação"}
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {isRejected
              ? "Sua solicitação de cadastro foi rejeitada pelo administrador. Se acredita que isso é um engano, entre em contato com o gestor do sistema."
              : "Seu cadastro foi recebido com sucesso. Um administrador precisa aprovar sua conta antes que você possa acessar o sistema. Tente novamente mais tarde."}
          </p>

          <button
            onClick={() => signOut()}
            className="mt-2 inline-flex items-center justify-center w-full h-11 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-sm transition"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
