import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const ListCultivares = () => {
  const { data = [], isLoading, error } = useCultivaresCatalog();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [editOriginal, setEditOriginal] = useState<{ cultivar: string; cultura: string | null } | null>(null);
  const [editCultivar, setEditCultivar] = useState<string>("");
  const [editCultura, setEditCultura] = useState<string>("");
  const [editNomeCientifico, setEditNomeCientifico] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = data || [];
    if (!q) return base;
    const result = base.filter((c: any) => {
      const hay = `${c.cultivar ?? ""} ${c.cultura ?? ""} ${c.nome_cientifico ?? ""}`.toLowerCase();
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
    const originalCultivar = editOriginal.cultivar;
    const originalCultura = editOriginal.cultura;

    try {
      const { error } = await supabase
        .from("cultivares_catalog")
        .update({ cultura: editCultura || null, nome_cientifico: editNomeCientifico || null })
        .eq("cultivar", originalCultivar)
        .eq("cultura", originalCultura);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Cultivar atualizado");
      setEditOpen(false);
      setEditOriginal(null);
      await queryClient.invalidateQueries({ queryKey: ["cultivares-catalog"] });
    } catch (e: any) {
      toast.error(e?.message || String(e));
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de Cultivares</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por cultivar, cultura ou nome científico..."
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
          <p className="text-sm text-muted-foreground">Carregando cultivares...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar cultivares.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cultivar</TableHead>
                <TableHead>Cultura</TableHead>
                <TableHead>Nome científico</TableHead>
                <TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((c: any, idx: number) => (
                <TableRow key={`${c.cod_item}-${idx}`}>
                  <TableCell>{c.cultivar}</TableCell>
                  <TableCell>{c.cultura}</TableCell>
                  <TableCell>{c.nome_cientifico}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditOriginal({ cultivar: c.cultivar, cultura: c.cultura ?? null });
                        setEditCultivar(String(c.cultivar || ""));
                        setEditCultura(String(c.cultura || ""));
                        setEditNomeCientifico(String(c.nome_cientifico || ""));
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
      </CardContent>
    </Card>
    <EditDialog
      open={editOpen}
      onOpenChange={(o) => setEditOpen(o)}
      original={editOriginal}
      cultivar={editCultivar}
      cultura={editCultura}
      nomeCientifico={editNomeCientifico}
      setCultivar={setEditCultivar}
      setCultura={setEditCultura}
      setNomeCientifico={setEditNomeCientifico}
      onSave={handleSave}
    />
    </>
  );
};

function EditDialog({
  open,
  onOpenChange,
  original,
  cultivar,
  cultura,
  nomeCientifico,
  setCultivar,
  setCultura,
  setNomeCientifico,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  original: { cultivar: string; cultura: string | null } | null;
  cultivar: string;
  cultura: string;
  nomeCientifico: string;
  setCultivar: (v: string) => void;
  setCultura: (v: string) => void;
  setNomeCientifico: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Cultivar</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Cultivar</Label>
            <Input value={cultivar} onChange={(e) => setCultivar(e.target.value)} disabled />
          </div>
          <div className="space-y-1">
            <Label>Cultura</Label>
            <Input value={cultura} onChange={(e) => setCultura(e.target.value)} placeholder="Ex: MILHO, SOJA, AVEIA" />
          </div>
          <div className="space-y-1">
            <Label>Nome científico</Label>
            <Input value={nomeCientifico} onChange={(e) => setNomeCientifico(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline edit dialog usage
// (helper removed)
