import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFertilizantesCatalog } from "@/hooks/useFertilizantesCatalog";

export const ListFertilizantes = () => {
  const { data = [], isLoading, error } = useFertilizantesCatalog();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return (data || []).filter((f: any) => {
      const hay = `${f.cod_item ?? ""} ${f.item ?? ""} ${f.marca ?? ""} ${f.principio_ativo ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query]);

  return (
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
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando fertilizantes...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar fertilizantes.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Princípio ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f: any, idx: number) => (
                <TableRow key={`${f.cod_item}-${idx}`}>
                  <TableCell>{f.cod_item}</TableCell>
                  <TableCell>{f.item}</TableCell>
                  <TableCell>{f.marca}</TableCell>
                  <TableCell>{f.principio_ativo}</TableCell>
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
      </CardContent>
    </Card>
  );
};