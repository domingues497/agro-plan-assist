import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCalendarioAplicacoes } from "@/hooks/useCalendarioAplicacoes";

export const ListCalendario = () => {
  const { data, isLoading, error } = useCalendarioAplicacoes();
  const rows = data?.rows || [];
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return (rows || []).filter((r) => {
      const hay = `${String(r.cod_aplic ?? "")} ${String(r.descr_aplicacao ?? "")} ${String(r.cod_classe ?? "")} ${String(r.descricao_classe ?? "")} ${String(r.trat_sementes ?? "")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendário de Aplicações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por aplicação, classe, código..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando calendário...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar calendário.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Cód. Aplicação</TableHead>
                <TableHead>Aplicação</TableHead>
                <TableHead className="w-[120px]">Cód. Classe</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Trat. Sementes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, idx) => (
                <TableRow key={`${r.cod_aplic}-${idx}`}>
                  <TableCell>{String(r.cod_aplic ?? "")}</TableCell>
                  <TableCell>{r.descr_aplicacao ?? "—"}</TableCell>
                  <TableCell>{String(r.cod_classe ?? "")}</TableCell>
                  <TableCell>{r.descricao_classe ?? "—"}</TableCell>
                  <TableCell>{r.trat_sementes ?? "—"}</TableCell>
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