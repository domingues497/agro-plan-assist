import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFazendas } from "@/hooks/useFazendas";

export const ListFazendas = () => {
  const { data = [], isLoading, error } = useFazendas();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return (data || []).filter((f) => {
      const hay = `${f.nomefazenda ?? ""} ${f.idfazenda ?? ""} ${f.numerocm ?? ""} ${f.numerocm_consultor ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query]);

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
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando fazendas...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar fazendas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">ID Fazenda</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[130px]">Número CM</TableHead>
                <TableHead className="w-[150px]">Área cultivável (ha)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f) => (
                <TableRow key={`${f.numerocm}-${f.idfazenda}`}>
                  <TableCell>{f.idfazenda}</TableCell>
                  <TableCell>{f.nomefazenda}</TableCell>
                  <TableCell>{f.numerocm}</TableCell>
                  <TableCell>{typeof f.area_cultivavel === "number" ? f.area_cultivavel : "—"}</TableCell>
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