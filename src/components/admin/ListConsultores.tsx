import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConsultores } from "@/hooks/useConsultores";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
// Migração para API Flask
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/utils";

export const ListConsultores = () => {
  const { data = [], isLoading, error } = useConsultores();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"numerocm_consultor" | "consultor" | "email">("consultor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openDeleteId, setOpenDeleteId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editConsultor, setEditConsultor] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPodeEditar, setEditPodeEditar] = useState<boolean>(false);
  const [editPermiteCorte, setEditPermiteCorte] = useState<boolean>(false);
  const qc = useQueryClient();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return (data || []).filter((c) => {
      const hay = `${c.numerocm_consultor ?? ""} ${c.consultor ?? ""} ${c.email ?? ""}`.toLowerCase();
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
      const res = await fetch(`${baseUrl}/consultores/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erro ao remover consultor: ${res.status}`);
      toast.success("Consultor removido");
      qc.invalidateQueries({ queryKey: ["consultores"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover consultor");
    } finally {
      setOpenDeleteId(null);
    }
  };

  const onOpenEdit = (row: any) => {
    setEditRow(row);
    setEditConsultor(row.consultor ?? "");
    setEditEmail(row.email ?? "");
    setEditPodeEditar(!!row.pode_editar_programacao);
    setEditPermiteCorte(!!row.permite_edicao_apos_corte);
  };

  const onSaveEdit = async () => {
    if (!editRow) return;
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/consultores/${editRow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          consultor: editConsultor, 
          email: editEmail, 
          pode_editar_programacao: !!editPodeEditar,
          permite_edicao_apos_corte: !!editPermiteCorte 
        })
      });
      if (!res.ok) throw new Error(`Erro ao atualizar consultor: ${res.status}`);
      toast.success("Consultor atualizado");
      qc.invalidateQueries({ queryKey: ["consultores"] });
      setEditRow(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar consultor");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por nome, CM consultor, email..."
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
          <p className="text-sm text-muted-foreground">Carregando consultores...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar consultores.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("numerocm_consultor")}>CM Consultor {sortKey === "numerocm_consultor" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("consultor")}>Nome {sortKey === "consultor" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("email")}>Email {sortKey === "email" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                  </button>
                </TableHead>
                <TableHead className="w-[160px]">Edição liberada</TableHead>
                <TableHead className="w-[160px]">Ignora Corte</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.numerocm_consultor}</TableCell>
                  <TableCell>{c.consultor}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!c.pode_editar_programacao} disabled id={`flag-${c.id}`} />
                      <Label htmlFor={`flag-${c.id}`} className="text-xs text-muted-foreground">{c.pode_editar_programacao ? "Sim" : "Não"}</Label>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!c.permite_edicao_apos_corte} disabled id={`flag-corte-${c.id}`} />
                      <Label htmlFor={`flag-corte-${c.id}`} className="text-xs text-muted-foreground">{c.permite_edicao_apos_corte ? "Sim" : "Não"}</Label>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => onOpenEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setOpenDeleteId(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">Nenhum resultado encontrado.</TableCell>
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
              <AlertDialogTitle>Excluir consultor?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O consultor será removido da base.
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
              <DialogTitle>Editar consultor</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={editConsultor} onChange={(e) => setEditConsultor(e.target.value)} />
              </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="pode-editar" checked={editPodeEditar} onCheckedChange={(c) => setEditPodeEditar(!!c)} />
              <Label htmlFor="pode-editar" className="cursor-pointer">Liberar edição de programações</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="permite-corte" checked={editPermiteCorte} onCheckedChange={(c) => setEditPermiteCorte(!!c)} />
              <Label htmlFor="permite-corte" className="cursor-pointer">Ignorar data de corte (pode editar após o prazo)</Label>
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
