import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";
import { CreateProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";

type FormAdubacaoProps = {
  onSubmit: (data: CreateProgramacaoAdubacao) => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export const FormAdubacao = ({ onSubmit, onCancel, isLoading }: FormAdubacaoProps) => {
  const [formData, setFormData] = useState<CreateProgramacaoAdubacao>({
    formulacao: "",
    area: "",
    dose: 0,
    total: null,
    data_aplicacao: null,
    responsavel: null,
    fertilizante_salvo: false,
    deve_faturar: true,
    porcentagem_salva: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Nova Adubação</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="formulacao">Formulação NPK *</Label>
            <Input
              id="formulacao"
              placeholder="Ex: 10-20-20"
              value={formData.formulacao}
              onChange={(e) => setFormData({ ...formData, formulacao: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="area">Área *</Label>
            <Input
              id="area"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dose">Dose (kg/ha) *</Label>
            <Input
              id="dose"
              type="number"
              step="0.01"
              value={formData.dose}
              onChange={(e) => setFormData({ ...formData, dose: parseFloat(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total">Total (kg)</Label>
            <Input
              id="total"
              type="number"
              step="0.01"
              value={formData.total || ""}
              onChange={(e) => setFormData({ ...formData, total: e.target.value ? parseFloat(e.target.value) : null })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_aplicacao">Data Aplicação</Label>
            <Input
              id="data_aplicacao"
              type="date"
              value={formData.data_aplicacao || ""}
              onChange={(e) => setFormData({ ...formData, data_aplicacao: e.target.value || null })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável</Label>
            <Input
              id="responsavel"
              value={formData.responsavel || ""}
              onChange={(e) => setFormData({ ...formData, responsavel: e.target.value || null })}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="fertilizante_salvo"
              checked={formData.fertilizante_salvo}
              onCheckedChange={(checked) => setFormData({ ...formData, fertilizante_salvo: !!checked })}
            />
            <Label htmlFor="fertilizante_salvo" className="font-medium">
              Fertilizante salvo de safra anterior (RN012)
            </Label>
          </div>

          {formData.fertilizante_salvo && (
            <>
              <div className="flex items-center space-x-2 pl-6">
                <Checkbox
                  id="deve_faturar"
                  checked={formData.deve_faturar}
                  onCheckedChange={(checked) => setFormData({ ...formData, deve_faturar: !!checked })}
                />
                <Label htmlFor="deve_faturar">
                  Deve faturar
                </Label>
              </div>

              <div className="space-y-2 pl-6">
                <Label htmlFor="porcentagem_salva">% de fertilizante salvo (RN013)</Label>
                <Input
                  id="porcentagem_salva"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.porcentagem_salva}
                  onChange={(e) => setFormData({ ...formData, porcentagem_salva: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  Porcentagem da área que usará fertilizante salvo
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar adubação"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
};
