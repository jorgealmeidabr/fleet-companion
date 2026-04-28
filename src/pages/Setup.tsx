import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, AlertCircle } from "lucide-react";

export default function Setup() {
  return (
    <div className="min-h-screen bg-gradient-dark px-4 py-12 text-foreground">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3 text-primary-foreground">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-brand shadow-elevated bg-warning">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">BRQ – Frota Interna</h1>
            <p className="text-sm text-white/60">Configuração inicial necessária</p>
          </div>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Conexão com Supabase não configurada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>O sistema está pronto, mas precisa de credenciais do Supabase para funcionar. Siga os passos:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Crie um projeto em <a className="text-primary underline" href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.</li>
              <li>No SQL Editor, rode na ordem os arquivos da pasta <code className="rounded bg-muted px-1 py-0.5">supabase_setup/</code> deste projeto:
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  <li><code>01_schema.sql</code></li>
                  <li><code>02_rls.sql</code></li>
                  <li><code>03_storage.sql</code></li>
                  <li>Crie sua conta em <code>/auth</code> depois rode <code>04_seed.sql</code></li>
                </ul>
              </li>
              <li>Em <strong>Settings → API</strong>, copie <em>Project URL</em> e <em>anon key</em>.</li>
              <li>Crie um arquivo <code className="rounded bg-muted px-1 py-0.5">.env</code> na raiz com:
                <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs">
{`VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
                </pre>
              </li>
              <li>Recarregue a página. Faça signup em <code>/auth</code> e promova-se a admin com:
                <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs">
{`insert into public.user_roles(user_id, role)
select id, 'admin' from auth.users
where email='SEU_EMAIL@exemplo.com'
on conflict do nothing;`}
                </pre>
              </li>
            </ol>
            <p className="text-muted-foreground">Veja <code>supabase_setup/README.md</code> para detalhes completos.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
