import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDefensivosCatalog } from "@/hooks/useDefensivosCatalog";

export const ListDefensivos = () => {
  const { data = [], isLoading, error } = useDefensivosCatalog();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return (data || []).filter((d: any) => {
      const hay = `${d.cod_item ?? ""} ${d.item ?? ""} ${d.marca ?? ""} ${d.principio_ativo ?? ""} ${d.grupo ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query]);

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
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando defensivos...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar defensivos.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Princípio ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d: any, idx: number) => (
                <TableRow key={`${d.cod_item}-${idx}`}>
                  <TableCell>{d.cod_item}</TableCell>
                  <TableCell>{d.item}</TableCell>
                  <TableCell>{d.grupo}</TableCell>
                  <TableCell>{d.marca}</TableCell>
                  <TableCell>{d.principio_ativo}</TableCell>
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
      </CardContent>
    </Card>
  );
};