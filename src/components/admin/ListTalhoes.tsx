import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useTalhoes } from "@/hooks/useTalhoes";
import { useFazendas } from "@/hooks/useFazendas";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";

type SortKey = "nome" | "area" | "fazenda";
type SortDirection = "asc" | "desc";

export function ListTalhoes() {
  const { data: talhoes = [], isLoading: loadingTalhoes } = useTalhoes();
  const { data: fazendas = [], isLoading: loadingFazendas } = useFazendas();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [editNome, setEditNome] = useState("");
  const [editArea, setEditArea] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const talhoesWithFazenda = useMemo(() => {
    return talhoes.map(talhao => ({
      ...talhao,
      fazenda: fazendas.find(f => f.id === talhao.fazenda_id),
    }));
  }, [talhoes, fazendas]);

  const filtered = useMemo(() => {
    if (!search) return talhoesWithFazenda;
    const lower = search.toLowerCase();
    return talhoesWithFazenda.filter(
      (t) =>
        t.nome.toLowerCase().includes(lower) ||
        t.fazenda?.nomefazenda?.toLowerCase().includes(lower)
    );
  }, [talhoesWithFazenda, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortKey === "fazenda") {
        aVal = a.fazenda?.nomefazenda || "";
        bVal = b.fazenda?.nomefazenda || "";
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDirection]);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const onDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("talhoes").delete().eq("id", deleteId);
    if (error) {
      toast.error("Erro ao deletar talhão");
      console.error(error);
    } else {
      toast.success("Talhão deletado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["talhoes"] });
    }
    setDeleteId(null);
  };

  const onOpenEdit = (item: any) => {
    setEditItem(item);
    setEditNome(item.nome);
    setEditArea(item.area.toString());
  };

  const onSaveEdit = async () => {
    if (!editItem) return;
    const area = parseFloat(editArea);
    if (isNaN(area) || area <= 0) {
      toast.error("Área inválida");
      return;
    }

    const { error } = await supabase
      .from("talhoes")
      .update({ nome: editNome, area })
      .eq("id", editItem.id);

    if (error) {
      toast.error("Erro ao atualizar talhão");
      console.error(error);
    } else {
      toast.success("Talhão atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["talhoes"] });
      setEditItem(null);
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="inline w-4 h-4 ml-1" />
    ) : (
      <ChevronDown className="inline w-4 h-4 ml-1" />
    );
  };

  if (loadingTalhoes || loadingFazendas) {
    return <div className="p-4">Carregando talhões...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Talhões Cadastrados ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Buscar por nome ou fazenda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex items-center gap-2">
              <Label>Itens por página:</Label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border rounded px-2 py-1"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("fazenda")}
                  >
                    Fazenda <SortIcon column="fazenda" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("nome")}
                  >
                    Talhão <SortIcon column="nome" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => toggleSort("area")}
                  >
                    Área (ha) <SortIcon column="area" />
                  </TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.fazenda?.nomefazenda || "-"}</TableCell>
                    <TableCell>{t.nome}</TableCell>
                    <TableCell className="text-right">{t.area.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenEdit(t)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteId(t.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este talhão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Talhão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome do Talhão</Label>
              <Input
                id="edit-nome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-area">Área (ha)</Label>
              <Input
                id="edit-area"
                type="number"
                step="0.01"
                value={editArea}
                onChange={(e) => setEditArea(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancelar
            </Button>
            <Button onClick={onSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
