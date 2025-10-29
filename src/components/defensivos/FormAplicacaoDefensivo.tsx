import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProdutores } from "@/hooks/useProdutores";
import { useDefensivosCatalog } from "@/hooks/useDefensivosCatalog";
import { useFazendas } from "@/hooks/useFazendas";
import type { DefensivoItem } from "@/hooks/useAplicacoesDefensivos";

type FormAplicacaoDefensivoProps = {
  onSubmit: (data: { produtor_numerocm: string; area: string; defensivos: Omit<DefensivoItem, "id">[] }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: {
    produtor_numerocm?: string;
    area?: string;
    defensivos?: DefensivoItem[];
  };
  title?: string;
  submitLabel?: string;
};

export const FormAplicacaoDefensivo = ({
  onSubmit,
  onCancel,
  isLoading = false,
  initialData,
  title = "Nova Aplicação de Defensivos",
  submitLabel = "Salvar aplicação",
}: FormAplicacaoDefensivoProps) => {
  const { data: produtores } = useProdutores();
  const { data: defensivosCatalog } = useDefensivosCatalog();

  const [produtorNumerocm, setProdutorNumerocm] = useState("");
  const [area, setArea] = useState("");
  const [openFazenda, setOpenFazenda] = useState(false);
  const { data: fazendas } = useFazendas(produtorNumerocm);
  
  const [defensivos, setDefensivos] = useState<Array<Omit<DefensivoItem, "id"> & { tempId: string; total?: number }>>([
    {
      tempId: crypto.randomUUID(),
      defensivo: "",
      dose: 0,
      unidade: "L/ha",
      alvo: "",
      produto_salvo: false,
      deve_faturar: true,
      porcentagem_salva: 0,
      area_hectares: 0,
      total: 0,
    },
  ]);

  const [openProdutorPopover, setOpenProdutorPopover] = useState(false);

  useEffect(() => {
    if (initialData) {
      setProdutorNumerocm(initialData.produtor_numerocm || "");
      setArea(initialData.area || "");
      if (initialData.defensivos && initialData.defensivos.length > 0) {
        setDefensivos(
          initialData.defensivos.map((def) => ({
            ...def,
            tempId: crypto.randomUUID(),
            total: (def.area_hectares || 0) * def.dose,
          }))
        );
      }
    }
  }, [initialData]);

  const handleAddDefensivo = () => {
    setDefensivos([
      ...defensivos,
      {
        tempId: crypto.randomUUID(),
        defensivo: "",
        dose: 0,
        unidade: "L/ha",
        alvo: "",
        produto_salvo: false,
        deve_faturar: true,
        porcentagem_salva: 0,
        area_hectares: 0,
        total: 0,
      },
    ]);
  };

  const handleRemoveDefensivo = (tempId: string) => {
    if (defensivos.length === 1) return;
    setDefensivos(defensivos.filter((d) => d.tempId !== tempId));
  };

  const handleDefensivoChange = (tempId: string, field: keyof Omit<DefensivoItem, "id">, value: any) => {
    setDefensivos(
      defensivos.map((d) => {
        if (d.tempId === tempId) {
          const updated = { ...d, [field]: value };
          if (field === "dose" || field === "area_hectares") {
            const dose = field === "dose" ? value : updated.dose;
            const area = field === "area_hectares" ? value : updated.area_hectares;
            updated.total = dose * area;
          }
          return updated;
        }
        return d;
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!produtorNumerocm || !area) {
      alert("Por favor, preencha Produtor e Fazenda");
      return;
    }

    if (defensivos.length === 0 || defensivos.some((d) => !d.defensivo || d.dose <= 0 || d.area_hectares <= 0)) {
      alert("Por favor, adicione pelo menos um defensivo válido com dose e área");
      return;
    }

    const defensivosToSubmit = defensivos.map(({ tempId, total, ...def }) => def);
    onSubmit({ produtor_numerocm: produtorNumerocm, area, defensivos: defensivosToSubmit });
  };

  const selectedProdutor = produtores.find((p) => p.numerocm === produtorNumerocm);

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seção fixa */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Produtor *</Label>
            <Popover open={openProdutorPopover} onOpenChange={setOpenProdutorPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {selectedProdutor ? `${selectedProdutor.numerocm} - ${selectedProdutor.nome}` : "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar produtor..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produtor encontrado.</CommandEmpty>
                    <CommandGroup>
                      {produtores.map((produtor) => (
                        <CommandItem
                          key={produtor.id}
                          value={`${produtor.numerocm} ${produtor.nome}`}
                          onSelect={() => {
                            setProdutorNumerocm(produtor.numerocm);
                            setArea("");
                            setOpenProdutorPopover(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              produtorNumerocm === produtor.numerocm ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {produtor.numerocm} - {produtor.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fazenda">Fazenda *</Label>
            <Popover open={openFazenda} onOpenChange={setOpenFazenda}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openFazenda}
                  className="w-full justify-between"
                  disabled={!produtorNumerocm}
                >
                  {area
                    ? fazendas.find(f => f.nomefazenda === area)?.nomefazenda || area
                    : "Selecione uma fazenda..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar fazenda..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma fazenda encontrada.</CommandEmpty>
                    <CommandGroup>
                      {fazendas?.map((f) => (
                        <CommandItem
                          key={f.id}
                          value={f.nomefazenda}
                          onSelect={(currentValue) => {
                            setArea(currentValue);
                            setOpenFazenda(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              area === f.nomefazenda ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {f.nomefazenda} {f.area_cultivavel && `(${f.area_cultivavel} ha)`}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Lista dinâmica de defensivos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Defensivos aplicados</Label>
            <Button type="button" onClick={handleAddDefensivo} size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar defensivo
            </Button>
          </div>

          {defensivos.map((defensivo, index) => (
            <DefensivoRow
              key={defensivo.tempId}
              defensivo={defensivo}
              index={index}
              defensivosCatalog={defensivosCatalog || []}
              onChange={(field, value) => handleDefensivoChange(defensivo.tempId, field, value)}
              onRemove={() => handleRemoveDefensivo(defensivo.tempId)}
              canRemove={defensivos.length > 1}
            />
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
};

type DefensivoRowProps = {
  defensivo: Omit<DefensivoItem, "id"> & { tempId: string; total?: number };
  index: number;
  defensivosCatalog: Array<{ item: string | null; cod_item: string; marca: string | null; principio_ativo: string | null }>;
  onChange: (field: keyof Omit<DefensivoItem, "id">, value: any) => void;
  onRemove: () => void;
  canRemove: boolean;
};

const DefensivoRow = ({ defensivo, index, defensivosCatalog, onChange, onRemove, canRemove }: DefensivoRowProps) => {
  const [openDefensivoPopover, setOpenDefensivoPopover] = useState(false);

  return (
    <Card className="p-4 bg-muted/50">
      <div className="flex items-start gap-4">
        <div className="flex-1 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Defensivo *</Label>
            <Popover open={openDefensivoPopover} onOpenChange={setOpenDefensivoPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {defensivo.defensivo || "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar defensivo..." />
                  <CommandList>
                    <CommandEmpty>Nenhum defensivo encontrado.</CommandEmpty>
                    <CommandGroup>
                      {defensivosCatalog.map((def) => (
                        <CommandItem
                          key={def.cod_item}
                          value={`${def.item} ${def.marca}`}
                          onSelect={() => {
                            onChange("defensivo", def.item || "");
                            setOpenDefensivoPopover(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              defensivo.defensivo === def.item ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {def.item} {def.marca && `- ${def.marca}`}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Dose *</Label>
            <Input
              type="number"
              step="0.01"
              value={defensivo.dose}
              onChange={(e) => onChange("dose", parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Unidade</Label>
            <Input
              value={defensivo.unidade}
              onChange={(e) => onChange("unidade", e.target.value)}
              placeholder="L/ha"
            />
          </div>

          <div className="space-y-2">
            <Label>Área (ha) *</Label>
            <Input
              type="number"
              step="0.01"
              value={defensivo.area_hectares}
              onChange={(e) => onChange("area_hectares", parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Total</Label>
            <Input
              type="number"
              step="0.01"
              value={defensivo.total?.toFixed(2) || "0.00"}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Alvo</Label>
            <Input
              value={defensivo.alvo || ""}
              onChange={(e) => onChange("alvo", e.target.value)}
              placeholder="Ex: Ferrugem"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`produto-salvo-${index}`}
                checked={defensivo.produto_salvo}
                onCheckedChange={(checked) => onChange("produto_salvo", checked)}
              />
              <Label htmlFor={`produto-salvo-${index}`} className="cursor-pointer">
                Produto salvo (RN012)
              </Label>
            </div>

            {defensivo.produto_salvo && (
              <div className="space-y-2 ml-6">
                <Label>% Salva</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={defensivo.porcentagem_salva}
                  onChange={(e) => onChange("porcentagem_salva", parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id={`deve-faturar-${index}`}
                checked={defensivo.deve_faturar}
                onCheckedChange={(checked) => onChange("deve_faturar", checked)}
              />
              <Label htmlFor={`deve-faturar-${index}`} className="cursor-pointer">
                Deve faturar
              </Label>
            </div>
          </div>
        </div>

        {canRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} title="Remover defensivo">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
};
