import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
// Migração para API Flask
import { useToast } from "@/hooks/use-toast";

export const ImportEpocas = () => {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { nome: string; descricao: string }) => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/epocas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: data.nome, descricao: data.descricao || null, ativa: true }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-epocas"] });
      toast({
        title: "Sucesso",
        description: "Época cadastrada com sucesso",
      });
      setNome("");
      setDescricao("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar",
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
        description: "O nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({ nome: nome.trim(), descricao: descricao.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cadastrar Nova Época</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Época *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Época 1"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional"
            />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Época
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
