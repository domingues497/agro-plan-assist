import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { getApiBaseUrl } from "@/lib/utils";
import { useJustificativasMutation } from "@/hooks/useJustificativasMutation";

export const ImportJustificativas = () => {
  const [descricao, setDescricao] = useState("");
  const { create, remove, isCreating, isDeleting } = useJustificativasMutation();

  const { data: justificativas = [] } = useJustificativasAdubacao(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      toast.error("Digite a descrição da justificativa");
      return;
    }
    create(descricao, {
      onSuccess: () => setDescricao(""),
    });
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
              <Button type="submit" className="w-full" disabled={isCreating}>
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
                      onClick={() => remove(j.id)}
                      disabled={isDeleting}
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
