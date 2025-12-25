import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useProdutores } from "@/hooks/useProdutores";
import { getApiBaseUrl } from "@/lib/utils";

interface GerenciarFlagsDialogProps {
  produtorNumerocm?: string;
  produtorId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GerenciarFlagsDialog({ produtorNumerocm, produtorId, open, onOpenChange }: GerenciarFlagsDialogProps) {
  const { data: produtores = [], refetch: refetchProdutores } = useProdutores();
  const produtor = produtores.find(p => p.id === produtorId) || 
                   (produtorNumerocm ? produtores.find(p => String(p.numerocm).trim() === String(produtorNumerocm).trim()) : undefined);

  const [produtorFlags, setProdutorFlags] = useState<{
    compra_insumos: boolean;
    entrega_producao: boolean;
    entrega_producao_destino: string;
    paga_assistencia: boolean;
    observacao_flags: string;
  }>({
    compra_insumos: true,
    entrega_producao: true,
    entrega_producao_destino: "COOP",
    paga_assistencia: true,
    observacao_flags: "",
  });

  useEffect(() => {
    if (produtor) {
      setProdutorFlags({
        compra_insumos: produtor.compra_insumos ?? true,
        entrega_producao: produtor.entrega_producao ?? true,
        entrega_producao_destino: produtor.entrega_producao_destino || (produtor.entrega_producao !== false ? "COOP" : "TERCEIRO"),
        paga_assistencia: produtor.paga_assistencia ?? true,
        observacao_flags: produtor.observacao_flags ?? "",
      });
    }
  }, [produtor]);

  const handleSaveFlags = async () => {
    const idToUpdate = produtorId || produtor?.id;
    if (!idToUpdate) return;
    
    // Validação removida: Observação agora é opcional mesmo com pendências
    /*
    if ((!produtorFlags.compra_insumos || !produtorFlags.entrega_producao || !produtorFlags.paga_assistencia) && !produtorFlags.observacao_flags.trim()) {
      toast.error("Observação é obrigatória quando há pendências nos flags");
      return;
    }
    */

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/produtores/${idToUpdate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(produtorFlags),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      toast.success("Flags do produtor atualizadas");
      onOpenChange(false);
      refetchProdutores();
    } catch (error) {
      toast.error("Erro ao atualizar flags");
    }
  };

  if (!produtor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2 border-b shrink-0">
          <DialogTitle>{produtor.nome}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 py-4 min-h-0">
          <div className="space-y-4 pb-4">
              
              {/* Bloco 1 - Assistência */}
              <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">1. Assistência Técnica</h3>
            <RadioGroup
              value={produtorFlags.paga_assistencia ? "COOP" : "TERCEIRO"}
              onValueChange={(val) => setProdutorFlags(prev => ({ ...prev, paga_assistencia: val === "COOP" }))}
              className="gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="COOP" id="assistencia-coop" />
                <Label htmlFor="assistencia-coop" className="font-normal">Paga assistência Coopagrícola</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="TERCEIRO" id="assistencia-terceiro" />
                <Label htmlFor="assistencia-terceiro" className="font-normal text-destructive">Tem assistência Terceiro</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Bloco 2 - Entrega / Armazenagem */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">2. Entrega / Armazenagem</h3>
            <RadioGroup
              value={produtorFlags.entrega_producao_destino}
              onValueChange={(val) => {
                setProdutorFlags(prev => ({
                  ...prev,
                  entrega_producao_destino: val,
                  entrega_producao: val === "COOP" // Only COOP is true
                }));
              }}
              className="gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="COOP" id="entrega-coop" />
                <Label htmlFor="entrega-coop" className="font-normal">Entrega produção Coopagrícola</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ARMAZEM_PROPRIO" id="entrega-armazem" />
                <Label htmlFor="entrega-armazem" className="font-normal text-destructive">Tem armazém próprio</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="TERCEIRO" id="entrega-terceiro" />
                <Label htmlFor="entrega-terceiro" className="font-normal text-destructive">Entrega para terceiro</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Bloco 3 - Compra de Insumos */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">3. Compra de Insumos</h3>
            <RadioGroup
              value={produtorFlags.compra_insumos ? "COOP" : "TERCEIRO"}
              onValueChange={(val) => setProdutorFlags(prev => ({ ...prev, compra_insumos: val === "COOP" }))}
              className="gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="COOP" id="insumos-coop" />
                <Label htmlFor="insumos-coop" className="font-normal">Compra insumos Coopagrícola</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="TERCEIRO" id="insumos-terceiro" />
                <Label htmlFor="insumos-terceiro" className="font-normal text-destructive">Faz cotação e compra com terceiro</Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Observação */}
          {(!produtorFlags.compra_insumos || !produtorFlags.entrega_producao || !produtorFlags.paga_assistencia) && (
            <div className="pt-2">
                <Label className="text-sm font-medium text-muted-foreground">Observação</Label>
                <Textarea 
                    value={produtorFlags.observacao_flags}
                    onChange={(e) => setProdutorFlags(prev => ({ ...prev, observacao_flags: e.target.value }))}
                    className="mt-1 h-20 resize-none bg-muted/30"
                    placeholder="Descreva o motivo (opcional)..."
                />
            </div>
          )}
          </div>
        </div>
        
        <div className="flex justify-end p-6 pt-2 border-t mt-0 shrink-0">
            <Button onClick={handleSaveFlags} className="w-full sm:w-auto">Salvar Alterações</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
