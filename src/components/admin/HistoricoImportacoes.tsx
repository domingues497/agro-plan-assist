import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

type ImportHistory = {
  id: string;
  user_id: string;
  tabela_nome: string;
  registros_importados: number;
  registros_deletados: number;
  arquivo_nome: string | null;
  limpar_antes: boolean;
  created_at: string;
};

export const HistoricoImportacoes = () => {
  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["import-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as ImportHistory[];
    },
  });

  const getTabelaLabel = (tabela: string) => {
    const labels: Record<string, string> = {
      calendario_aplicacoes: "Calendário de Aplicações",
      cultivares_catalog: "Cultivares",
      defensivos_catalog: "Defensivos",
      fertilizantes_catalog: "Fertilizantes",
      produtores: "Produtores",
      fazendas: "Fazendas",
      consultores: "Consultores",
    };
    return labels[tabela] || tabela;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Importações</CardTitle>
        <CardDescription>
          Últimas 100 importações realizadas no sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead className="text-right">Importados</TableHead>
                <TableHead className="text-right">Deletados</TableHead>
                <TableHead className="text-center">Limpou Antes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma importação registrada
                  </TableCell>
                </TableRow>
              ) : (
                historico.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getTabelaLabel(item.tabela_nome)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={item.arquivo_nome || ""}>
                      {item.arquivo_nome || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {item.registros_importados}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      {item.registros_deletados}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.limpar_antes ? (
                        <Badge variant="destructive">Sim</Badge>
                      ) : (
                        <Badge variant="secondary">Não</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};