import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFazendas } from "@/hooks/useFazendas";
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
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useConsultores } from "@/hooks/useConsultores";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProdutores } from "@/hooks/useProdutores";
import { getApiBaseUrl } from "@/lib/utils";

export const ListFazendas = () => {
  const { data = [], isLoading, error } = useFazendas();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<
    "idfazenda" | "nomefazenda" | "numerocm" | "produtor_nome" | "consultor_nome"
  >("nomefazenda");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openDeleteKey, setOpenDeleteKey] = useState<{ idfazenda: string; numerocm: string } | null>(null);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editNumerocmConsultor, setEditNumerocmConsultor] = useState<string>("");
  const [editCadpro, setEditCadpro] = useState("");
  const qc = useQueryClient();
  const { data: consultores = [] } = useConsultores();
  const { data: produtores = [] } = useProdutores();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return (data || []).filter((f) => {
      const prodNome = produtores.find((p: any) => String(p.numerocm || "") === String(f.numerocm || ""))?.nome || "";
      const consNome = consultores.find((c: any) => String(c.numerocm_consultor || "") === String(f.numerocm_consultor || ""))?.consultor || "";
      const consCm = consultores.find((c: any) => String(c.numerocm_consultor || "") === String(f.numerocm_consultor || ""))?.numerocm_consultor || "";
      const hay = `${f.nomefazenda ?? ""} ${f.idfazenda ?? ""} ${f.numerocm ?? ""} ${String(f.numerocm_consultor ?? "")} ${prodNome} ${consNome} ${consCm}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query, produtores, consultores]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      let avStr = "";
      let bvStr = "";
      if (sortKey === "produtor_nome") {
        const aNome = produtores.find((p: any) => String(p.numerocm || "") === String(a.numerocm || ""))?.nome;
        const bNome = produtores.find((p: any) => String(p.numerocm || "") === String(b.numerocm || ""))?.nome;
        avStr = String(aNome ?? "").toLowerCase();
        bvStr = String(bNome ?? "").toLowerCase();
      } else if (sortKey === "consultor_nome") {
        const aNome = consultores.find((c: any) => String(c.numerocm_consultor || "") === String(a.numerocm_consultor || ""))?.consultor;
        const bNome = consultores.find((c: any) => String(c.numerocm_consultor || "") === String(b.numerocm_consultor || ""))?.consultor;
        avStr = String(aNome ?? "").toLowerCase();
        bvStr = String(bNome ?? "").toLowerCase();
      } else {
        const av = a[sortKey];
        const bv = b[sortKey];
        avStr = String(av ?? "").toLowerCase();
        bvStr = String(bv ?? "").toLowerCase();
      }
      if (avStr < bvStr) return sortDir === "asc" ? -1 : 1;
      if (avStr > bvStr) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, produtores, consultores]);

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

  const deleteMutation = useMutation({
    mutationFn: async (key: { idfazenda: string; numerocm: string }) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/fazendas/by_key`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numerocm: key.numerocm, idfazenda: key.idfazenda }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      return true;
    },
    onSuccess: () => {
      toast.success("Fazenda removida");
      qc.invalidateQueries({ queryKey: ["fazendas", "by-consultor"] });
      setOpenDeleteKey(null);
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao remover fazenda");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: { row: any; nome: string; consultor: string | null; cadpro: string }) => {
      const { row, nome, consultor, cadpro } = vars;
      const payload: any = { nomefazenda: nome, cadpro };
      payload.numerocm_consultor = consultor;
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/fazendas/by_key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numerocm: row.numerocm,
          idfazenda: row.idfazenda,
          ...payload,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      return true;
    },
    onSuccess: () => {
      toast.success("Fazenda atualizada");
      qc.invalidateQueries({ queryKey: ["fazendas", "by-consultor"] });
      setEditRow(null);
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao atualizar fazenda");
    }
  });

  const onDelete = (key: { idfazenda: string; numerocm: string }) => {
    deleteMutation.mutate(key);
  };

  const onOpenEdit = (row: any) => {
    setEditRow(row);
    setEditNome(row.nomefazenda ?? "");
    setEditNumerocmConsultor(row.numerocm_consultor != null ? String(row.numerocm_consultor) : "");
    setEditCadpro(row.cadpro ?? "");
  };

  const onSaveEdit = () => {
    if (!editRow) return;
    updateMutation.mutate({
      row: editRow,
      nome: editNome,
      consultor: editNumerocmConsultor ? String(editNumerocmConsultor) : null,
      cadpro: editCadpro,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fazendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por nome, ID fazenda, número CM..."
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
          <p className="text-sm text-muted-foreground">Carregando fazendas...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar fazendas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("numerocm")}>Produtor {sortKey === "numerocm" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("nomefazenda")}>Fazenda {sortKey === "nomefazenda" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("consultor_nome")}>Consultor {sortKey === "consultor_nome" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
                </TableHead>
                <TableHead>CadPro</TableHead>
                {/* coluna de área removida: área agora é gerenciada pelos talhões */}
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((f) => (
                <TableRow key={`${f.numerocm}-${f.idfazenda}`}>
                  <TableCell>
                    {(() => {
                      const p = produtores.find((p: any) => String(p.numerocm || "") === String(f.numerocm || ""));
                      const cm = f.numerocm ? String(f.numerocm) : "";
                      const nome = p?.nome || "";
                      const txt = `${cm}${cm && nome ? " - " : ""}${nome}`.trim();
                      return txt || "—";
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const id = f.idfazenda ?? "";
                      const nome = f.nomefazenda ?? "";
                      const txt = `${id}${id && nome ? " - " : ""}${nome}`.trim();
                      return txt || "—";
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const c = consultores.find((c: any) => String(c.numerocm_consultor || "") === String(f.numerocm_consultor || ""));
                      if (!c) return "—";
                      const cm = c.numerocm_consultor ? String(c.numerocm_consultor) : "";
                      const nome = c.consultor || "";
                      const txt = `${cm}${cm && nome ? " - " : ""}${nome}`.trim();
                      return txt || "—";
                    })()}
                  </TableCell>
                  <TableCell>
                    {f.cadpro || "—"}
                  </TableCell>
                  {/* área cultivável removida da listagem */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => onOpenEdit(f)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setOpenDeleteKey({ idfazenda: f.idfazenda, numerocm: f.numerocm })}>
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">Nenhum resultado encontrado.</TableCell>
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
        <AlertDialog open={!!openDeleteKey} onOpenChange={(o) => !o && setOpenDeleteKey(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir fazenda?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A fazenda será removida da base.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => openDeleteKey && onDelete(openDeleteKey)}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Editar */}
        <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar fazenda</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>CadPro</Label>
                <Input value={editCadpro} onChange={(e) => setEditCadpro(e.target.value)} />
              </div>
              {/* campo de área cultivável removido: gerencie via talhões */}
              <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label>Consultor</Label>
                  <Select
                    value={editNumerocmConsultor || undefined}
                    onValueChange={(val) => setEditNumerocmConsultor(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o consultor" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultores.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.numerocm_consultor || "")}>
                          {c.numerocm_consultor ? String(c.numerocm_consultor) : "—"}
                          {c.consultor ? ` - ${c.consultor}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
