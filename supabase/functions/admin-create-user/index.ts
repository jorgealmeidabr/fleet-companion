// Edge Function: admin-create-user
// Cria usuário no Auth via service role e grava os registros necessários explicitamente.
// Deploy:  supabase functions deploy admin-create-user --project-ref <ref>
// Secrets necessários no projeto Supabase:
//   - SUPABASE_URL                  (já vem por padrão)
//   - SUPABASE_ANON_KEY             (já vem por padrão)
//   - SUPABASE_SERVICE_ROLE_KEY     (configurar no painel: Project Settings → Functions → Secrets)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  email: string;
  senha: string;
  nome: string;
  telefone?: string | null;
  cargo: string;
  cnh_numero?: string | null;
  cnh_categoria?: string | null;
  cnh_validade?: string | null;
  tipo_conta: "admin" | "usuario";
  permissoes: Record<string, boolean>;
}

const fallbackCnhValidade = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  return d.toISOString().slice(0, 10);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE) {
    return json(
      { error: "Service role key não configurada no projeto Supabase. Adicione SUPABASE_SERVICE_ROLE_KEY nas Functions → Secrets." },
      500,
    );
  }

  // 1. Autenticar o caller e verificar se é admin
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return json({ error: "Token ausente" }, 401);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const caller = await userRes.json().catch(() => null) as { id?: string; error?: string; msg?: string } | null;
  if (!userRes.ok || !caller?.id) {
    return json({ error: "Não autenticado" }, 401);
  }
  const callerUserId = caller.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: perfil, error: perfilErr } = await admin
    .from("usuarios_perfis")
    .select("tipo_conta, ativo")
    .eq("user_id", callerUserId)
    .maybeSingle();

  if (perfilErr) return json({ error: "Erro ao verificar perfil: " + perfilErr.message }, 500);
  if (!perfil || perfil.tipo_conta !== "admin" || !perfil.ativo) {
    return json({ error: "Apenas administradores podem criar usuários" }, 403);
  }

  // 2. Validar payload
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const {
    email, senha, nome, telefone, cargo,
    cnh_numero, cnh_categoria, cnh_validade,
    tipo_conta, permissoes,
  } = body;

  const cleanEmail = String(email ?? "").trim().toLowerCase();
  const cleanNome = String(nome ?? "").trim();
  const cleanCargo = String(cargo ?? "").trim();
  if (!cleanEmail || !senha || !cleanNome || !cleanCargo || !tipo_conta) {
    return json({ error: "Campos obrigatórios ausentes (email, senha, nome, cargo, tipo_conta)" }, 400);
  }
  if (senha.length < 8) return json({ error: "Senha deve ter ao menos 8 caracteres" }, 400);
  if (!["admin", "usuario"].includes(tipo_conta)) return json({ error: "tipo_conta inválido" }, 400);

  // 3. Criar usuário no Auth com privilégios administrativos
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: cleanNome, cargo: cleanCargo },
  });

  if (createErr || !created?.user) {
    return json({ error: "Falha ao criar usuário no Auth: " + (createErr?.message ?? "desconhecido") }, 400);
  }
  const userId = created.user.id;

  // Helper: rollback do auth user em caso de erro nas etapas seguintes
  const rollback = async (msg: string) => {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return json({ error: msg }, 400);
  };

  // 4. Garante public.profiles manualmente. Não depende do trigger on_auth_user_created.
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: userId, nome: cleanNome, email: cleanEmail }, { onConflict: "id" });
  if (profileErr) return rollback("Erro ao criar profile: " + profileErr.message);

  // 5. Admin: promover por RPC e finalizar. Não buscar/alterar motorista depois.
  if (tipo_conta === "admin") {
    const { error: promoErr } = await admin.rpc("promote_to_admin", { _email: cleanEmail });
    if (promoErr) return rollback("Erro ao promover admin: " + promoErr.message);
    return json({ user_id: userId, tipo_conta: "admin" });
  }

  // 6. Motorista: sempre insere um motorista explicitamente e cria usuarios_perfis explicitamente.
  const { data: motorista, error: motoristaErr } = await admin
    .from("motoristas")
    .insert({
      user_id: userId,
      nome: cleanNome,
      email: cleanEmail,
      telefone: telefone || null,
      cargo: cleanCargo || null,
      cnh_numero: cnh_numero || "00000000000",
      cnh_categoria: cnh_categoria || "B",
      cnh_validade: cnh_validade || fallbackCnhValidade(),
      status: "ativo",
    })
    .select("id")
    .single();
  if (motoristaErr || !motorista) return rollback("Erro ao criar motorista: " + (motoristaErr?.message ?? "desconhecido"));
  const motoristaId = motorista.id;

  const { error: perfilErr } = await admin.from("usuarios_perfis").upsert({
    user_id: userId,
    motorista_id: motoristaId,
    tipo_conta: "usuario",
    permissoes,
    ativo: true,
    must_change_password: true,
  }, { onConflict: "user_id" });
  if (perfilErr) return rollback("Erro ao criar perfil de acesso: " + perfilErr.message);

  return json({ user_id: userId, motorista_id: motoristaId, tipo_conta: "usuario" });
});
