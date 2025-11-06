import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";

export const ImportTratamentos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [cultura, setCultura] = useState<"MILHO" | "SOJA">("MILHO");

  const { data: tratamentos = [] } = useQuery({
    queryKey: ["admin-tratamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tratamentos_sementes")
        .select("*")
        .order("cultura", { ascending: true })
        .order("nome", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tratamentos_sementes")
        .insert({ nome, cultura, ativo: true });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tratamentos"] });
      toast({ title: "Tratamento cadastrado com sucesso!" });
      setNome("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cadastrar tratamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tratamentos_sementes")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tratamentos"] });
      toast({ title: "Tratamento excluído com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir tratamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast({
        title: "Erro",
        description: "Digite o nome do tratamento",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Tratamentos de Sementes</CardTitle>
        <CardDescription>
          Cadastre e gerencie os tratamentos disponíveis para milho e soja
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nome do Tratamento</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Tratamento Premium"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Cultura</Label>
              <Select value={cultura} onValueChange={(value) => setCultura(value as "MILHO" | "SOJA")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MILHO">Milho</SelectItem>
                  <SelectItem value="SOJA">Soja</SelectItem>
                </SelectContent>
              </Select>
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
                <TableHead>Nome</TableHead>
                <TableHead>Cultura</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tratamentos.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.nome}</TableCell>
                  <TableCell>{t.cultura}</TableCell>
                  <TableCell>{t.ativo ? "Ativo" : "Inativo"}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteMutation.mutate(t.id)}
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
