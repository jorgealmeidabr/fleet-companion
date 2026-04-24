import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  rows: T[];
  loading: boolean;
  columns: Column<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  empty?: string;
}

export function DataTable<T extends { id: string }>({ rows, loading, columns, onEdit, onDelete, empty = "Nenhum registro." }: Props<T>) {
  const { isAdmin } = useAuth();
  return (
    <Card className="shadow-card">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c, i) => <TableHead key={i} className={c.className}>{c.header}</TableHead>)}
                {(onEdit || onDelete) && isAdmin && <TableHead className="w-24 text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={columns.length + 1} className="py-10 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length + 1} className="py-10 text-center text-muted-foreground">{empty}</TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id}>
                  {columns.map((c, i) => <TableCell key={i} className={c.className}>{c.cell(r)}</TableCell>)}
                  {(onEdit || onDelete) && isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {onEdit && <Button size="icon" variant="ghost" onClick={() => onEdit(r)}><Pencil className="h-4 w-4" /></Button>}
                        {onDelete && <Button size="icon" variant="ghost" onClick={() => { if (confirm("Confirmar exclusão?")) onDelete(r); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
