import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProdutores } from "@/hooks/useProdutores";

export const ListProdutores = () => {
  const { data = [], isLoading, error } = useProdutores();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return (data || []).filter((p) => {
      const hay = `${p.numerocm ?? ""} ${p.nome ?? ""} ${p.consultor ?? ""} ${p.numerocm_consultor ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por nome, número CM, consultor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando produtores...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar produtores.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Número CM</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead className="w-[160px]">CM Consultor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.numerocm}</TableCell>
                  <TableCell>{p.nome}</TableCell>
                  <TableCell>{p.consultor ?? "—"}</TableCell>
                  <TableCell>{p.numerocm_consultor}</TableCell>
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