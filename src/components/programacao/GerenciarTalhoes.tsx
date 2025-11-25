import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Pencil } from "lucide-react";
import { useTalhoes } from "@/hooks/useTalhoes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

interface GerenciarTalhoesProps {
  fazendaId: string;
  fazendaNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GerenciarTalhoes({ fazendaId, fazendaNome, open, onOpenChange }: GerenciarTalhoesProps) {
  const { data: talhoes = [], refetch } = useTalhoes(fazendaId);
  const [editando, setEditando] = useState<{ id?: string; nome: string; area: string } | null>(null);

  const handleSalvar = async () => {
    if (!editando) return;
    
    const area = parseFloat(editando.area);
    if (isNaN(area) || area <= 0) {
      toast.error("Área deve ser um número positivo");
      return;
    }

    try {
      if (editando.id) {
        // Editar
        const { error } = await supabase
          .from("talhoes")
          .update({ nome: editando.nome, area })
          .eq("id", editando.id);
        
        if (error) throw error;
        toast.success("Talhão atualizado");
      } else {
        // Criar
        const { error } = await supabase
          .from("talhoes")
          .insert({ fazenda_id: fazendaId, nome: editando.nome, area });
        
        if (error) throw error;
        toast.success("Talhão criado");
      }
      
      setEditando(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar talhão");
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Deseja excluir este talhão?")) return;
    
    try {
      const { error } = await supabase
        .from("talhoes")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Talhão excluído");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir talhão");
    }
  };

  const areaTotal = talhoes.reduce((sum, t) => sum + Number(t.area), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Talhões - {fazendaNome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Área total: <span className="font-semibold">{areaTotal.toFixed(2)} ha</span>
            </p>
            <Button
              onClick={() => setEditando({ nome: "", area: "" })}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Talhão
            </Button>
          </div>

          {editando && (
            <Card className="p-4 bg-muted/50">
              <div className="space-y-3">
                <div>
                  <Label>Nome do Talhão</Label>
                  <Input
                    value={editando.nome}
                    onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                    placeholder="Ex: Talhão 1"
                  />
                </div>
                <div>
                  <Label>Área (ha)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editando.area}
                    onChange={(e) => setEditando({ ...editando, area: e.target.value })}
                    placeholder="Ex: 50.5"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSalvar} size="sm">
                    Salvar
                  </Button>
                  <Button onClick={() => setEditando(null)} variant="outline" size="sm">
                    Cancelar
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {talhoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum talhão cadastrado
              </p>
            ) : (
              talhoes.map((talhao) => (
                <Card key={talhao.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{talhao.nome}</p>
                    <p className="text-sm text-muted-foreground">{Number(talhao.area).toFixed(2)} ha</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setEditando({ id: talhao.id, nome: talhao.nome, area: talhao.area.toString() })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleExcluir(talhao.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
