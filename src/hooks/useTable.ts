import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export function useTable<T extends { id: string }>(table: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase.from(table as any).select("*").order("created_at", { ascending: false });
    if (error) toast({ title: `Erro ao carregar ${table}`, description: error.message, variant: "destructive" });
    setRows((data ?? []) as T[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const id = setInterval(reload, 10_000);
    return () => clearInterval(id);
    /* eslint-disable-next-line */
  }, [table]);

  const insert = async (values: Partial<T>) => {
    const { error } = await (supabase.from(table as any) as any).insert(values);
    if (error) { toast({ title: "Erro ao criar", description: error.message, variant: "destructive" }); throw error; }
    toast({ title: "Registro criado" }); await reload();
  };
  const update = async (id: string, values: Partial<T>) => {
    const { error } = await (supabase.from(table as any) as any).update(values).eq("id", id);
    if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); throw error; }
    toast({ title: "Atualizado" }); await reload();
  };
  const remove = async (id: string) => {
    const { error } = await (supabase.from(table as any) as any).delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Removido" }); await reload();
  };

  return { rows, loading, reload, insert, update, remove };
}
