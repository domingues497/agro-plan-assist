import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSafras } from "@/hooks/useSafras";
import { Trash2, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ImportSafras = () => {
  const { safras, create, update, remove, isCreating, isDeleting } = useSafras();
  const [nome, setNome] = useState("");
  const [anoInicio, setAnoInicio] = useState("");
  const [anoFim, setAnoFim] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) return;

    create({
      nome: nome.trim(),
      is_default: isDefault,
      ativa: true,
      ano_inicio: anoInicio ? parseInt(anoInicio) : null,
      ano_fim: anoFim ? parseInt(anoFim) : null,
    });

    setNome("");
    setAnoInicio("");
    setAnoFim("");
    setIsDefault(false);
  };

  const handleToggleDefault = (id: string, currentDefault: boolean) => {
    update({ id, is_default: !currentDefault });
  };

  const handleToggleAtiva = (id: string, currentAtiva: boolean) => {
    update({ id, ativa: !currentAtiva });
  };

  const handleDelete = () => {
    if (deleteId) {
      remove(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar Nova Safra</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="nome">Nome da Safra *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: 2024/2025"
                  required
                />
              </div>
              <div>
                <Label htmlFor="anoInicio">Ano Início</Label>
                <Input
                  id="anoInicio"
                  type="number"
                  value={anoInicio}
                  onChange={(e) => setAnoInicio(e.target.value)}
                  placeholder="2024"
                />
              </div>
              <div>
                <Label htmlFor="anoFim">Ano Fim</Label>
                <Input
                  id="anoFim"
                  type="number"
                  value={anoFim}
                  onChange={(e) => setAnoFim(e.target.value)}
                  placeholder="2025"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isDefault"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked as boolean)}
              />
              <Label htmlFor="isDefault" className="cursor-pointer">
                Definir como safra padrão
              </Label>
            </div>
            <Button type="submit" disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Safra
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safras Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-center">Padrão</TableHead>
                <TableHead className="text-center">Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safras.map((safra) => (
                <TableRow key={safra.id}>
                  <TableCell className="font-medium">{safra.nome}</TableCell>
                  <TableCell>
                    {safra.ano_inicio && safra.ano_fim
                      ? `${safra.ano_inicio} - ${safra.ano_fim}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={safra.is_default}
                      onCheckedChange={() => handleToggleDefault(safra.id, safra.is_default)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={safra.ativa}
                      onCheckedChange={() => handleToggleAtiva(safra.id, safra.ativa)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(safra.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {safras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma safra cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta safra? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
