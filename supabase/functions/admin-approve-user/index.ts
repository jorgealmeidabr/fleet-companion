// Edge Function: admin-approve-user
// Confirma o e-mail do usuário pendente (email_confirm: true) usando service_role
// e em seguida chama o RPC approve_user para criar motorista + usuarios_perfis
// e marcar o profile como 'ativo'.
//
// Deploy: supabase functions deploy admin-approve-user --no-verify-jwt
// Secrets necessários: SUPABASE_SERVICE_ROLE_KEY (já há SUPABASE_URL e SUPABASE_ANON_KEY por padrão).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Payload {
  user_id: string;
  tipo: "admin" | "usuario";
  cargo?: string | null;
  permissoes?: Record<string, boolean> | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE) {
    return json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada nas Functions Secrets." }, 500);
  }

  // 1. Autenticar caller e validar admin
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
  const token = authHeader.slice("Bearer ".length).trim();

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  const caller = await userRes.json().catch(() => null) as { id?: string } | null;
  if (!userRes.ok || !caller?.id) return json({ error: "Não autenticado" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: perfilCaller, error: perfilErr } = await admin
    .from("usuarios_perfis")
    .select("tipo_conta, ativo")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (perfilErr) return json({ error: "Erro ao verificar perfil: " + perfilErr.message }, 500);
  if (!perfilCaller || perfilCaller.tipo_conta !== "admin" || !perfilCaller.ativo) {
    return json({ error: "Apenas administradores podem aprovar usuários" }, 403);
  }

  // 2. Validar payload
  let body: Payload;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const { user_id, tipo, cargo, permissoes } = body;
  if (!user_id || !tipo || !["admin", "usuario"].includes(tipo)) {
    return json({ error: "Payload inválido (user_id e tipo obrigatórios)" }, 400);
  }

  // 3. Confirmar e-mail no Auth (seta email_confirmed_at) — preserva a senha do usuário
  const { error: confirmErr } = await admin.auth.admin.updateUserById(user_id, {
    email_confirm: true,
  });
  if (confirmErr) return json({ error: "Erro ao confirmar e-mail: " + confirmErr.message }, 400);

  // 4. Chamar RPC approve_user (cria motorista + usuarios_perfis + status='ativo')
  const { error: rpcErr } = await admin.rpc("approve_user", {
    _user_id: user_id,
    _tipo: tipo,
    _permissoes: permissoes ?? null,
    _cargo: cargo ?? null,
  });
  if (rpcErr) return json({ error: "Erro no approve_user: " + rpcErr.message }, 400);

  return json({ ok: true, user_id, tipo });
});
