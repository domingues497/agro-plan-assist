import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCalendarioAplicacoes } from "@/hooks/useCalendarioAplicacoes";
import { Button } from "@/components/ui/button";
// Migração para API Flask
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const ListCalendario = () => {
  const { data, isLoading, error } = useCalendarioAplicacoes();
  const rows = data?.rows || [];
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<
    "cod_aplic" | "descr_aplicacao" | "cod_classe" | "descricao_classe" | "trat_sementes"
  >("descricao_classe");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openDeleteId, setOpenDeleteId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editDescrAplicacao, setEditDescrAplicacao] = useState("");
  const [editCodClasse, setEditCodClasse] = useState("");
  const [editDescricaoClasse, setEditDescricaoClasse] = useState("");
  const [editTratSementes, setEditTratSementes] = useState("");
  const [editCodAplicGer, setEditCodAplicGer] = useState("");
  const qc = useQueryClient();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return (rows || []).filter((r) => {
      const hay = `${String(r.cod_aplic ?? "")} ${String(r.descr_aplicacao ?? "")} ${String(r.cod_classe ?? "")} ${String(r.descricao_classe ?? "")} ${String(r.trat_sementes ?? "")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

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
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/calendario_aplicacoes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      toast.success("Aplicação removida");
      qc.invalidateQueries({ queryKey: ["calendario-aplicacoes"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover aplicação");
    } finally {
      setOpenDeleteId(null);
    }
  };

  const onOpenEdit = (row: any) => {
    setEditRow(row);
    setEditDescrAplicacao(row.descr_aplicacao ?? "");
    setEditCodClasse(String(row.cod_classe ?? ""));
    setEditDescricaoClasse(row.descricao_classe ?? "");
    setEditTratSementes(row.trat_sementes ?? "");
    setEditCodAplicGer(String(row.cod_aplic_ger ?? ""));
  };

  const onSaveEdit = async () => {
    if (!editRow) return;
    try {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const payload = {
        descr_aplicacao: editDescrAplicacao,
        cod_classe: editCodClasse || null,
        descricao_classe: editDescricaoClasse,
        trat_sementes: editTratSementes || null,
        cod_aplic_ger: editCodAplicGer || null,
      };
      const res = await fetch(`${baseUrl}/calendario_aplicacoes/${editRow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      toast.success("Aplicação atualizada");
      qc.invalidateQueries({ queryKey: ["calendario-aplicacoes"] });
      setEditRow(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar aplicação");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendário de Aplicações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por aplicação, classe, código..."
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
          <p className="text-sm text-muted-foreground">Carregando calendário...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar calendário.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("cod_aplic")}>Cód. Aplicação {sortKey === "cod_aplic" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("descr_aplicacao")}>Aplicação {sortKey === "descr_aplicacao" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                  </button>
                </TableHead>
                <TableHead className="w-[140px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("cod_classe")}>Cód. Classe {sortKey === "cod_classe" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("descricao_classe")}>Classe {sortKey === "descricao_classe" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("trat_sementes")}>Trat. Sementes {sortKey === "trat_sementes" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                  </button>
                </TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r, idx) => (
                <TableRow key={`${r.cod_aplic}-${idx}`}>
                  <TableCell>{String(r.cod_aplic ?? "")}</TableCell>
                  <TableCell>{r.descr_aplicacao ?? "—"}</TableCell>
                  <TableCell>{String(r.cod_classe ?? "")}</TableCell>
                  <TableCell>{r.descricao_classe ?? "—"}</TableCell>
                  <TableCell>{r.trat_sementes ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => onOpenEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => r.id && setOpenDeleteId(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">Nenhum resultado encontrado.</TableCell>
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
              <AlertDialogTitle>Excluir aplicação?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A aplicação será removida da base.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => openDeleteId && onDelete(openDeleteId)}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Editar */}
        <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar aplicação</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Cód. aplicação (somente leitura)</Label>
                <Input value={String(editRow?.cod_aplic ?? "")} readOnly />
              </div>
              <div className="space-y-1">
                <Label>Aplicação</Label>
                <Input value={editDescrAplicacao} onChange={(e) => setEditDescrAplicacao(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Cód. classe</Label>
                  <Input value={editCodClasse} onChange={(e) => setEditCodClasse(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Classe</Label>
                  <Input value={editDescricaoClasse} onChange={(e) => setEditDescricaoClasse(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Trat. sementes</Label>
                  <Input value={editTratSementes} onChange={(e) => setEditTratSementes(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Cód. aplic. ger.</Label>
                  <Input value={editCodAplicGer} onChange={(e) => setEditCodAplicGer(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRow(null)}>Cancelar</Button>
              <Button onClick={onSaveEdit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
