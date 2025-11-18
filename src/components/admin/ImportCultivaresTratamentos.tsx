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
  const [selectedTratamento, setSelectedTratamento] = useState<string>("");
  const [selectedCultivares, setSelectedCultivares] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleToggleCultivar = (cultivarCodItem: string) => {
    setSelectedCultivares(prev => 
      prev.includes(cultivarCodItem)
        ? prev.filter(id => id !== cultivarCodItem)
        : [...prev, cultivarCodItem]
    );
  };

  const handleSave = async () => {
    if (!selectedTratamento) {
      toast.error("Selecione um tratamento");
      return;
    }

    if (selectedCultivares.length === 0) {
      toast.error("Selecione pelo menos um cultivar");
      return;
    }

    setLoading(true);
    try {
      // Remove vínculos existentes deste tratamento
      await supabase
        .from("cultivares_tratamentos")
        .delete()
        .eq("tratamento_id", selectedTratamento);

      // Insere novos vínculos
      const inserts = selectedCultivares.map(cultivarCodItem => ({
        cultivar_cod_item: cultivarCodItem,
        tratamento_id: selectedTratamento,
      }));

      const { error } = await supabase
        .from("cultivares_tratamentos")
        .insert(inserts);

      if (error) throw error;

      toast.success("Cultivares vinculados com sucesso!");
      setSelectedTratamento("");
      setSelectedCultivares([]);
    } catch (error) {
      console.error("Erro ao vincular cultivares:", error);
      toast.error("Erro ao vincular cultivares");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vincular Cultivares aos Tratamentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Tratamento</Label>
          <Select value={selectedTratamento} onValueChange={setSelectedTratamento}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um tratamento" />
            </SelectTrigger>
            <SelectContent>
              {tratamentos?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTratamento && (
          <div className="space-y-2">
            <Label>Cultivares Disponíveis</Label>
            <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
              {cultivares?.map((c) => (
                <div key={c.cod_item} className="flex items-center space-x-2">
                  <Checkbox
                    id={c.cod_item}
                    checked={selectedCultivares.includes(c.cod_item)}
                    onCheckedChange={() => handleToggleCultivar(c.cod_item)}
                  />
                  <Label htmlFor={c.cod_item} className="cursor-pointer">
                    {c.cultivar} - {c.cultura}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={loading || !selectedTratamento}>
          {loading ? "Salvando..." : "Salvar Vínculos"}
        </Button>
      </CardContent>
    </Card>
  );
};
