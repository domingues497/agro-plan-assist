import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConsultores } from "@/hooks/useConsultores";

export const ListConsultores = () => {
  const { data = [], isLoading, error } = useConsultores();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return (data || []).filter((c) => {
      const hay = `${c.numerocm_consultor ?? ""} ${c.consultor ?? ""} ${c.email ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por nome, CM consultor, email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando consultores...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar consultores.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">CM Consultor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.numerocm_consultor}</TableCell>
                  <TableCell>{c.consultor}</TableCell>
                  <TableCell>{c.email}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">Nenhum resultado encontrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};