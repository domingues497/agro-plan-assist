import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useEpocasMutation } from "@/hooks/useEpocasMutation";

export const ImportEpocas = () => {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const { create, isCreating } = useEpocasMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }

    create({ nome: nome.trim(), descricao: descricao.trim() }, {
      onSuccess: () => {
        setNome("");
        setDescricao("");
      }
    });
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
          <Button type="submit" disabled={isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Época
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
