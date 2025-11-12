import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";

export const ListCultivares = () => {
  const { data = [], isLoading, error } = useCultivaresCatalog();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return (data || []).filter((c: any) => {
      const hay = `${c.cod_item ?? ""} ${c.item ?? ""} ${c.grupo ?? ""} ${c.marca ?? ""} ${c.cultivar ?? ""} ${c.cultura ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de Cultivares</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por nome, grupo, marca..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando cultivares...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar cultivares.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead>Cultivar</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Cultura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any, idx: number) => (
                <TableRow key={`${c.cod_item}-${idx}`}>
                  <TableCell>{c.cod_item}</TableCell>
                  <TableCell>{c.cultivar}</TableCell>
                  <TableCell>{c.item}</TableCell>
                  <TableCell>{c.grupo}</TableCell>
                  <TableCell>{c.marca}</TableCell>
                  <TableCell>{c.cultura ?? "—"}</TableCell>
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
      </CardContent>
    </Card>
  );
};