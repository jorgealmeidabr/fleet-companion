// Edge Function: admin-create-user
// Cria um usuário no Auth + motorista + perfil. Apenas admins autenticados.
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
  link_motorista_id?: string | null; // se vincular a motorista existente
}

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

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user) return json({ error: "Sessão inválida" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: perfil, error: perfilErr } = await admin
    .from("usuarios_perfis")
    .select("tipo_conta, ativo")
    .eq("user_id", callerData.user.id)
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
    tipo_conta, permissoes, link_motorista_id,
  } = body;

  if (!email || !senha || !nome || !cargo || !tipo_conta) {
    return json({ error: "Campos obrigatórios ausentes (email, senha, nome, cargo, tipo_conta)" }, 400);
  }
  if (senha.length < 8) return json({ error: "Senha deve ter ao menos 8 caracteres" }, 400);
  if (!["admin", "usuario"].includes(tipo_conta)) return json({ error: "tipo_conta inválido" }, 400);

  // 3. Criar usuário no Auth
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, cargo },
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

  // 4. Vincular ou criar motorista
  let motoristaId: string;
  if (link_motorista_id) {
    const { error: linkErr } = await admin
      .from("motoristas")
      .update({ user_id: userId })
      .eq("id", link_motorista_id);
    if (linkErr) return rollback("Erro ao vincular motorista: " + linkErr.message);
    motoristaId = link_motorista_id;
  } else {
    const fallbackValidade = new Date(Date.now() + 5 * 365 * 86400000).toISOString().slice(0, 10);
    const { data: mNew, error: mErr } = await admin
      .from("motoristas")
      .insert({
        nome,
        email,
        telefone: telefone || null,
        cargo,
        cnh_numero: cnh_numero || "00000000000",
        cnh_categoria: cnh_categoria || "B",
        cnh_validade: cnh_validade || fallbackValidade,
        user_id: userId,
        status: "ativo",
      })
      .select("id")
      .single();
    if (mErr || !mNew) return rollback("Erro ao criar motorista: " + (mErr?.message ?? ""));
    motoristaId = mNew.id;
  }

  // 5. Criar perfil
  const { error: pErr } = await admin.from("usuarios_perfis").insert({
    user_id: userId,
    motorista_id: motoristaId,
    tipo_conta,
    permissoes,
    ativo: true,
    must_change_password: true,
  });
  if (pErr) return rollback("Erro ao criar perfil: " + pErr.message);

  return json({ user_id: userId, motorista_id: motoristaId });
});
