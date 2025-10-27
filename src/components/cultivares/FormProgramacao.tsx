import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { CreateProgramacaoCultivar } from "@/hooks/useProgramacaoCultivares";
import { useProdutores } from "@/hooks/useProdutores";

type FormProgramacaoProps = {
  onSubmit: (data: CreateProgramacaoCultivar) => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export const FormProgramacao = ({ onSubmit, onCancel, isLoading }: FormProgramacaoProps) => {
  const [open, setOpen] = useState(false);
  const { data: cultivares } = useCultivaresCatalog();
  const { data: produtores } = useProdutores();
  const [openProdutor, setOpenProdutor] = useState(false);
  
  const [formData, setFormData] = useState<CreateProgramacaoCultivar>({
    cultivar: "",
    area: "",
    produtor_numerocm: "",
    quantidade: 0,
    unidade: "kg",
    data_plantio: null,
    safra: null,
    semente_propria: false,
    referencia_rnc_mapa: null,
    porcentagem_salva: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Nova Programação</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="produtor">Produtor *</Label>
            <Popover open={openProdutor} onOpenChange={setOpenProdutor}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openProdutor}
                  className="w-full justify-between"
                >
                  {formData.produtor_numerocm
                    ? `${formData.produtor_numerocm} - ${(produtores.find(p => p.numerocm === formData.produtor_numerocm)?.nome) || ""}`
                    : "Selecione um produtor..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar produtor..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produtor encontrado.</CommandEmpty>
                    <CommandGroup>
                      {produtores?.map((p) => (
                        <CommandItem
                          key={p.numerocm}
                          value={p.numerocm}
                          onSelect={(currentValue) => {
                            setFormData({ ...formData, produtor_numerocm: currentValue });
                            setOpenProdutor(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.produtor_numerocm === p.numerocm ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {p.numerocm} - {p.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cultivar">Cultivar *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {formData.cultivar || "Selecione um cultivar..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar cultivar..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cultivar encontrado.</CommandEmpty>
                    <CommandGroup>
                      {cultivares?.map((cultivar) => (
                        <CommandItem
                          key={cultivar.numero_registro}
                          value={cultivar.cultivar || ""}
                          onSelect={(currentValue) => {
                            setFormData({ ...formData, cultivar: currentValue });
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.cultivar === cultivar.cultivar ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {cultivar.cultivar}
                          {cultivar.nome_comum && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({cultivar.nome_comum})
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
            <Label htmlFor="quantidade">Quantidade *</Label>
            <Input
              id="quantidade"
              type="number"
              step="0.01"
              value={formData.quantidade}
              onChange={(e) => setFormData({ ...formData, quantidade: parseFloat(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidade">Unidade</Label>
            <Select value={formData.unidade} onValueChange={(value) => setFormData({ ...formData, unidade: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="sc">sc (sacas)</SelectItem>
                <SelectItem value="un">un (unidades)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_plantio">Data Plantio</Label>
            <Input
              id="data_plantio"
              type="date"
              value={formData.data_plantio || ""}
              onChange={(e) => setFormData({ ...formData, data_plantio: e.target.value || null })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="safra">Safra</Label>
            <Input
              id="safra"
              placeholder="2024/2025"
              value={formData.safra || ""}
              onChange={(e) => setFormData({ ...formData, safra: e.target.value || null })}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="semente_propria"
              checked={formData.semente_propria}
              onCheckedChange={(checked) => setFormData({ ...formData, semente_propria: !!checked })}
            />
            <Label htmlFor="semente_propria" className="font-medium">
              Semente própria (RN011)
            </Label>
          </div>

          {formData.semente_propria && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="referencia_rnc_mapa">Referência RNC MAPA</Label>
              <Input
                id="referencia_rnc_mapa"
                placeholder="Ex: RNC-2024-1234"
                value={formData.referencia_rnc_mapa || ""}
                onChange={(e) => setFormData({ ...formData, referencia_rnc_mapa: e.target.value || null })}
              />
            </div>
          )}

          {formData.semente_propria && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="porcentagem_salva">% de semente salva (RN013)</Label>
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
                Porcentagem da área que usará semente salva
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar programação"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
};
