import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTalhoes } from "@/hooks/useTalhoes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";

interface GerenciarTalhoesProps {
  fazendaId: string;
  fazendaNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GerenciarTalhoes({ fazendaId, fazendaNome, open, onOpenChange }: GerenciarTalhoesProps) {
  const { data: talhoes = [], refetch } = useTalhoes(fazendaId);
  const [editando, setEditando] = useState<{ id?: string; nome: string; area: string; arrendado: boolean } | null>(null);
  const queryClient = useQueryClient();

  const handleSalvar = async () => {
    if (!editando) return;
    
    const area = parseFloat(editando.area);
    if (isNaN(area) || area <= 0) {
      toast.error("Área deve ser um número positivo");
      return;
    }

    try {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      if (editando.id) {
        const res = await fetch(`${baseUrl}/talhoes/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: editando.nome, area, arrendado: editando.arrendado }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt);
        }
        toast.success("Talhão atualizado");
      } else {
        const res = await fetch(`${baseUrl}/talhoes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fazenda_id: fazendaId, nome: editando.nome, area, arrendado: editando.arrendado }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt);
        }
        toast.success("Talhão criado");
      }
      
      setEditando(null);
      refetch();
      // Invalida queries de fazendas para recalcular área cultivável
      queryClient.invalidateQueries({ queryKey: ["fazendas"] });
      queryClient.invalidateQueries({ queryKey: ["fazendas-multi"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar talhão");
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Deseja excluir este talhão?")) return;
    
    try {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      const res = await fetch(`${baseUrl}/talhoes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      toast.success("Talhão excluído");
      refetch();
      // Invalida queries de fazendas para recalcular área cultivável
      queryClient.invalidateQueries({ queryKey: ["fazendas"] });
      queryClient.invalidateQueries({ queryKey: ["fazendas-multi"] });
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
              onClick={() => setEditando({ nome: "", area: "", arrendado: false })}
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
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="arrendado"
                    checked={editando.arrendado}
                    onCheckedChange={(checked) => setEditando({ ...editando, arrendado: checked as boolean })}
                  />
                  <Label htmlFor="arrendado" className="cursor-pointer">Talhão Arrendado</Label>
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{talhao.nome}</p>
                      {talhao.arrendado && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">Arrendado</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{Number(talhao.area).toFixed(2)} ha</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setEditando({ id: talhao.id, nome: talhao.nome, area: talhao.area.toString(), arrendado: talhao.arrendado })}
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
