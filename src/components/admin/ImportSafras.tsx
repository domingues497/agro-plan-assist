import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSafras } from "@/hooks/useSafras";
import { Trash2, Plus, Pencil } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const ImportSafras = () => {
  const { safras, create, update, remove, isCreating, isDeleting, isUpdating } = useSafras();
  const [nome, setNome] = useState("");
  const [anoInicio, setAnoInicio] = useState("");
  const [anoFim, setAnoFim] = useState("");
  const [dataCorte, setDataCorte] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit state
  const [editSafra, setEditSafra] = useState<any | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editAnoInicio, setEditAnoInicio] = useState("");
  const [editAnoFim, setEditAnoFim] = useState("");
  const [editDataCorte, setEditDataCorte] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) return;

    create({
      nome: nome.trim(),
      is_default: isDefault,
      ativa: true,
      ano_inicio: anoInicio ? parseInt(anoInicio) : null,
      ano_fim: anoFim ? parseInt(anoFim) : null,
      data_corte_programacao: dataCorte || null,
    });

    setNome("");
    setAnoInicio("");
    setAnoFim("");
    setDataCorte("");
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

  const openEdit = (safra: any) => {
    setEditSafra(safra);
    setEditNome(safra.nome);
    setEditAnoInicio(safra.ano_inicio?.toString() || "");
    setEditAnoFim(safra.ano_fim?.toString() || "");
    // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
    let d = "";
    if (safra.data_corte_programacao) {
      const date = new Date(safra.data_corte_programacao);
      // Adjust to local ISO string
      const offset = date.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
      d = localISOTime;
    }
    setEditDataCorte(d);
  };

  const handleSaveEdit = () => {
    if (!editSafra) return;
    update({
      id: editSafra.id,
      nome: editNome,
      ano_inicio: editAnoInicio ? parseInt(editAnoInicio) : null,
      ano_fim: editAnoFim ? parseInt(editAnoFim) : null,
      data_corte_programacao: editDataCorte ? new Date(editDataCorte).toISOString() : null,
    });
    setEditSafra(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar Nova Safra</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div>
                <Label htmlFor="dataCorte">Data Corte Programação</Label>
                <Input
                  id="dataCorte"
                  type="datetime-local"
                  value={dataCorte}
                  onChange={(e) => setDataCorte(e.target.value)}
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
                <TableHead>Data Corte</TableHead>
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
                  <TableCell>
                    {safra.data_corte_programacao 
                      ? new Date(safra.data_corte_programacao).toLocaleString() 
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
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(safra)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(safra.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {safras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
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

      <Dialog open={!!editSafra} onOpenChange={(o) => !o && setEditSafra(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Safra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input id="edit-nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-inicio">Ano Início</Label>
                <Input id="edit-inicio" type="number" value={editAnoInicio} onChange={(e) => setEditAnoInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-fim">Ano Fim</Label>
                <Input id="edit-fim" type="number" value={editAnoFim} onChange={(e) => setEditAnoFim(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-corte">Data Corte Programação</Label>
              <Input 
                id="edit-corte" 
                type="datetime-local" 
                value={editDataCorte} 
                onChange={(e) => setEditDataCorte(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSafra(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={isUpdating}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
