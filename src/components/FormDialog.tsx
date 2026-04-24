import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: { label: string; value: string }[];
  step?: string;
}

interface Props<T extends Record<string, any>> {
  title: string;
  fields: FieldDef[];
  initial?: Partial<T>;
  onSubmit: (values: Partial<T>) => Promise<void> | void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  submitLabel?: string;
}

export function FormDialog<T extends Record<string, any>>({
  title, fields, initial, onSubmit, trigger, open, onOpenChange, submitLabel = "Salvar",
}: Props<T>) {
  const [internal, setInternal] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open! : internal;
  const setOpen = (v: boolean) => { isControlled ? onOpenChange?.(v) : setInternal(v); };
  const [values, setValues] = useState<Record<string, any>>({ ...initial });
  const [saving, setSaving] = useState(false);

  const change = (name: string, v: any) => setValues(s => ({ ...s, [name]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSubmit(values as Partial<T>); setOpen(false); } finally { setSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { setOpen(v); if (v) setValues({ ...initial }); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ?? <Button className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1 h-4 w-4" />Novo</Button>}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map(f => (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={f.name}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              {f.type === "select" ? (
                <Select value={values[f.name] ?? ""} onValueChange={(v) => change(f.name, v)}>
                  <SelectTrigger id={f.name}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{f.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea id={f.name} value={values[f.name] ?? ""} onChange={(e) => change(f.name, e.target.value)} required={f.required} />
              ) : f.type === "checkbox" ? (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id={f.name} checked={!!values[f.name]} onChange={(e) => change(f.name, e.target.checked)} className="h-4 w-4 rounded border-border" />
                  <span className="text-sm text-muted-foreground">{f.label}</span>
                </div>
              ) : (
                <Input id={f.name} type={f.type ?? "text"} step={f.step} required={f.required}
                       value={values[f.name] ?? ""} onChange={(e) => change(f.name, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />
              )}
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-gradient-brand text-primary-foreground">{saving ? "Salvando..." : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
