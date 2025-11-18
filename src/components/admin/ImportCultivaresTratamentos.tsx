import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { useTratamentosSementes } from "@/hooks/useTratamentosSementes";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const ImportCultivaresTratamentos = () => {
  const { data: cultivares } = useCultivaresCatalog();
  const { data: tratamentos } = useTratamentosSementes();
  const [selectedCultivar, setSelectedCultivar] = useState<string>("");
  const [selectedTratamentos, setSelectedTratamentos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleToggleTratamento = (tratamentoId: string) => {
    setSelectedTratamentos(prev => 
      prev.includes(tratamentoId)
        ? prev.filter(id => id !== tratamentoId)
        : [...prev, tratamentoId]
    );
  };

  const handleSave = async () => {
    if (!selectedCultivar) {
      toast.error("Selecione um cultivar");
      return;
    }

    if (selectedTratamentos.length === 0) {
      toast.error("Selecione pelo menos um tratamento");
      return;
    }

    setLoading(true);
    try {
      // Remove vínculos existentes
      await supabase
        .from("cultivares_tratamentos")
        .delete()
        .eq("cultivar_cod_item", selectedCultivar);

      // Insere novos vínculos
      const inserts = selectedTratamentos.map(tratamentoId => ({
        cultivar_cod_item: selectedCultivar,
        tratamento_id: tratamentoId,
      }));

      const { error } = await supabase
        .from("cultivares_tratamentos")
        .insert(inserts);

      if (error) throw error;

      toast.success("Tratamentos vinculados com sucesso!");
      setSelectedCultivar("");
      setSelectedTratamentos([]);
    } catch (error) {
      console.error("Erro ao vincular tratamentos:", error);
      toast.error("Erro ao vincular tratamentos");
    } finally {
      setLoading(false);
    }
  };

  const cultivarSelecionado = cultivares?.find(c => c.cod_item === selectedCultivar);
  const tratamentosFiltrados = tratamentos?.filter(
    t => !cultivarSelecionado?.cultura || t.cultura === cultivarSelecionado.cultura
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vincular Tratamentos aos Cultivares</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Cultivar</Label>
          <Select value={selectedCultivar} onValueChange={setSelectedCultivar}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cultivar" />
            </SelectTrigger>
            <SelectContent>
              {cultivares?.map((c) => (
                <SelectItem key={c.cod_item} value={c.cod_item}>
                  {c.cultivar} - {c.cultura}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCultivar && (
          <div className="space-y-2">
            <Label>Tratamentos Disponíveis</Label>
            <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
              {tratamentosFiltrados?.map((t) => (
                <div key={t.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={t.id}
                    checked={selectedTratamentos.includes(t.id)}
                    onCheckedChange={() => handleToggleTratamento(t.id)}
                  />
                  <Label htmlFor={t.id} className="cursor-pointer">
                    {t.nome} ({t.cultura})
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={loading || !selectedCultivar}>
          {loading ? "Salvando..." : "Salvar Vínculos"}
        </Button>
      </CardContent>
    </Card>
  );
};
