import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useDefensivosCatalog } from "@/hooks/useDefensivosCatalog";

export const ListDefensivos = () => {
  const { data = [], isLoading, error } = useDefensivosCatalog();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = data || [];
    if (!q) return base;
    const result = base.filter((d: any) => {
      const hay = `${d.cod_item ?? ""} ${d.item ?? ""} ${d.marca ?? ""} ${d.principio_ativo ?? ""} ${d.grupo ?? ""} ${d.saldo ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    return result;
  }, [data, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const groupStats = useMemo(() => {
    const groups: Record<string, number> = {};
    filtered.forEach((d: any) => {
      const grupo = d.grupo || 'Sem grupo';
      groups[grupo] = (groups[grupo] || 0) + 1;
    });
    return groups;
  }, [filtered]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de Defensivos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por item, grupo, marca, princípio ativo..."
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
          <p className="text-sm text-muted-foreground">Carregando defensivos...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar defensivos.</p>
        ) : (
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead className="min-w-[280px]">Item</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Princípio ativo</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((d: any, idx: number) => (
                <TableRow key={`${d.cod_item}-${idx}`}>
                  <TableCell>{d.cod_item}</TableCell>
                  <TableCell>
                    <span className="block whitespace-normal break-words" title={d.item || ""}>
                      {d.item}
                    </span>
                  </TableCell>
                  <TableCell>{d.grupo}</TableCell>
                  <TableCell>{d.marca}</TableCell>
                  <TableCell>{d.principio_ativo}</TableCell>
                  <TableCell className="text-right">{d.saldo?.toFixed(2) || '0.00'}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
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

        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="bg-primary/5 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Total de Itens</div>
              <div className="text-2xl font-bold text-primary">{filtered.length}</div>
            </div>
            {Object.entries(groupStats)
              .sort(([, a], [, b]) => b - a)
              .map(([grupo, count]) => (
                <div key={grupo} className="bg-secondary/5 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1 truncate" title={grupo}>{grupo}</div>
                  <div className="text-2xl font-bold">{count}</div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};