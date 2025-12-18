import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProdutores } from "@/hooks/useProdutores";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/utils";

export const ListProdutores = () => {
  const { data = [], isLoading, error } = useProdutores();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"numerocm" | "nome" | "consultor" | "numerocm_consultor">("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openDeleteId, setOpenDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return (data || []).filter((p) => {
      const hay = `${p.numerocm ?? ""} ${p.nome ?? ""} ${p.consultor ?? ""} ${p.numerocm_consultor ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      const av = String(a[sortKey] ?? "").toLowerCase();
      const bv = String(b[sortKey] ?? "").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const onDelete = async (id: string) => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/produtores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      toast.success("Produtor removido");
      qc.invalidateQueries({ queryKey: ["produtores", "by-consultor"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover produtor");
    } finally {
      setOpenDeleteId(null);
    }
  };

  // Edição removida conforme solicitado; mantendo apenas exclusão

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por nome, número CM, consultor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="pageSize" className="text-xs">Itens/página</Label>
            <select
              id="pageSize"
              className="border rounded h-8 px-2 text-sm"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando produtores...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar produtores.</p>
        ) : (
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("nome")}>Produtor {sortKey === "nome" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                  </button>
                </TableHead>
                <TableHead>Assistência</TableHead>

                <TableHead className="w-[120px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="block whitespace-normal break-words" title={`${p.numerocm ?? ""} - ${p.nome ?? ""}`}>
                      {p.numerocm}{p.nome ? ` - ${p.nome}` : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    {p.assistencia || "-"}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="destructive" size="sm" onClick={() => setOpenDeleteId(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">Nenhum resultado encontrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-muted-foreground">Página {page} de {totalPages}</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
          </div>
        </div>

        {/* Confirmar exclusão */}
        <AlertDialog open={!!openDeleteId} onOpenChange={(o) => !o && setOpenDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir produtor?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O produtor será removido da base.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => openDeleteId && onDelete(openDeleteId)}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Ação de editar removida */}
      </CardContent>
    </Card>
  );
};
