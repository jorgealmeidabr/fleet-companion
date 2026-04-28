import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Motorista } from "@/lib/types";

interface Props {
  motoristas: Motorista[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Campo de motorista com busca por digitação.
 * - Ao digitar a primeira letra, prioriza nomes que COMEÇAM com a letra.
 * - Também aceita ocorrências em qualquer posição (substring).
 */
export function MotoristaAutocomplete({
  motoristas, value, onChange, placeholder = "Selecione...", disabled, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => motoristas.find(m => m.id === value) ?? null,
    [motoristas, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return motoristas;
    const starts = motoristas.filter(m => m.nome.toLowerCase().startsWith(q));
    const contains = motoristas.filter(
      m => !m.nome.toLowerCase().startsWith(q) && m.nome.toLowerCase().includes(q),
    );
    return [...starts, ...contains];
  }, [motoristas, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected?.nome ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Digite para buscar..."
              className="border-0 focus:ring-0"
            />
          </div>
          <CommandList>
            <CommandEmpty>Nenhum motorista encontrado.</CommandEmpty>
            <CommandGroup>
              {filtered.map(m => (
                <CommandItem
                  key={m.id}
                  value={m.id}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === m.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{m.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
