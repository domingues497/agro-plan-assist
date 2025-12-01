import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { useFertilizantesCatalog } from "@/hooks/useFertilizantesCatalog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const ListFertilizantes = () => {
  const { data = [], isLoading, error } = useFertilizantesCatalog();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [editOriginal, setEditOriginal] = useState<{ cod_item: string } | null>(null);
  const [editCodItem, setEditCodItem] = useState<string>("");
  const [editItem, setEditItem] = useState<string>("");
  const [editMarca, setEditMarca] = useState<string>("");
  const [editPrincipioAtivo, setEditPrincipioAtivo] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = data || [];
    if (!q) return base;
    const result = base.filter((f: any) => {
      const hay = `${f.cod_item ?? ""} ${f.item ?? ""} ${f.marca ?? ""} ${f.principio_ativo ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    return result;
  }, [data, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleSave = async () => {
    if (!editOriginal) return;
    const { cod_item } = editOriginal;
    try {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/fertilizantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cod_item,
          item: editItem || null,
          marca: editMarca || null,
          principio_ativo: editPrincipioAtivo || null,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error(txt);
        return;
      }
      toast.success("Fertilizante atualizado");
      setEditOpen(false);
      setEditOriginal(null);
      await queryClient.invalidateQueries({ queryKey: ["fertilizantes-catalog"] });
    } catch (e: any) {
      toast.error(e?.message || String(e));
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de Fertilizantes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por item, marca, princípio ativo..."
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
          <p className="text-sm text-muted-foreground">Carregando fertilizantes...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar fertilizantes.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Princípio ativo</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((f: any, idx: number) => (
                <TableRow key={`${f.cod_item}-${idx}`}>
                  <TableCell>{f.cod_item}</TableCell>
                  <TableCell>{f.item}</TableCell>
                  <TableCell>{f.marca}</TableCell>
                  <TableCell>{f.principio_ativo}</TableCell>
                  <TableCell>{typeof f.saldo === "number" ? f.saldo : "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditOriginal({ cod_item: String(f.cod_item) });
                        setEditCodItem(String(f.cod_item || ""));
                        setEditItem(String(f.item || ""));
                        setEditMarca(String(f.marca || ""));
                        setEditPrincipioAtivo(String(f.principio_ativo || ""));
                        setEditOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
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
      </CardContent>
    </Card>
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Fertilizante</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Código</Label>
            <Input value={editCodItem} onChange={(e) => setEditCodItem(e.target.value)} disabled />
          </div>
          <div className="space-y-1">
            <Label>Item</Label>
            <Input value={editItem} onChange={(e) => setEditItem(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Marca</Label>
            <Input value={editMarca} onChange={(e) => setEditMarca(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Princípio ativo</Label>
            <Input value={editPrincipioAtivo} onChange={(e) => setEditPrincipioAtivo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};
