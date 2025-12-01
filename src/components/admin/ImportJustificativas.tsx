import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";

export const ImportJustificativas = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [descricao, setDescricao] = useState("");

  const { data: justificativas = [] } = useQuery({
    queryKey: ["admin-justificativas"],
    queryFn: async () => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/justificativas_adubacao`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/justificativas_adubacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao, ativo: true }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-justificativas"] });
      toast({ title: "Justificativa cadastrada com sucesso!" });
      setDescricao("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cadastrar justificativa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/justificativas_adubacao/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-justificativas"] });
      toast({ title: "Justificativa excluída com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir justificativa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      toast({
        title: "Erro",
        description: "Digite a descrição da justificativa",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Justificativas de Adubação</CardTitle>
        <CardDescription>
          Cadastre e gerencie as justificativas para quando o produtor não realizar adubação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Descrição da Justificativa</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Solo já adubado"
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </form>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {justificativas.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>{j.descricao}</TableCell>
                  <TableCell>{j.ativo ? "Ativo" : "Inativo"}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteMutation.mutate(j.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
