import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Migração para API Flask
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getApiBaseUrl } from "@/lib/utils";

export const ListEpocas = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: epocas, isLoading } = useQuery({
    queryKey: ["admin-epocas"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/epocas`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return json?.items;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/epocas/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-epocas"] });
      toast({
        title: "Sucesso",
        description: "Época excluída com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Épocas Cadastradas</CardTitle>
        <CardDescription>Lista de todas as épocas no sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {epocas?.map((epoca) => (
              <TableRow key={epoca.id}>
                <TableCell className="font-medium">{epoca.nome}</TableCell>
                <TableCell>{epoca.descricao || "-"}</TableCell>
                <TableCell>
                  <Badge variant={epoca.ativa ? "default" : "secondary"}>
                    {epoca.ativa ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(epoca.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
