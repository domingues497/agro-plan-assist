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
import { Badge } from "@/components/ui/badge";
import { useProdutores } from "@/hooks/useProdutores";
import { useDefensivosCatalog } from "@/hooks/useDefensivosCatalog";
import { useCalendarioAplicacoes } from "@/hooks/useCalendarioAplicacoes";
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
  const { data: calendario } = useCalendarioAplicacoes();

  const [produtorNumerocm, setProdutorNumerocm] = useState("");
  const [area, setArea] = useState("");
  const [openFazenda, setOpenFazenda] = useState(false);
  const { data: fazendas } = useFazendas(produtorNumerocm);
  const [selectedAreaHa, setSelectedAreaHa] = useState<number>(0);
  
  const [defensivos, setDefensivos] = useState<Array<Omit<DefensivoItem, "id"> & { tempId: string; total?: number }>>([
    {
      tempId: crypto.randomUUID(),
      defensivo: "",
      dose: 0,
      unidade: "L/ha",
      alvo: "",
      aplicacoes: [],
      produto_salvo: false,
      deve_faturar: true,
      porcentagem_salva: 0,
      area_hectares: 0,
      total: 0,
    },
  ]);

  const [openProdutorPopover, setOpenProdutorPopover] = useState(false);

  // Seleções de calendário agora são por produto (na linha)

  useEffect(() => {
    if (initialData) {
      setProdutorNumerocm(initialData.produtor_numerocm || "");
      setArea(initialData.area || "");
      if (initialData.defensivos && initialData.defensivos.length > 0) {
        setDefensivos(
          initialData.defensivos.map((def) => ({
            ...def,
            tempId: crypto.randomUUID(),
            // Separar as aplicações concatenadas do campo alvo
            aplicacoes: def.alvo ? def.alvo.split(",").map(a => a.trim()) : [],
            total: (def.area_hectares || 0) * def.dose,
          }))
        );
        setSelectedAreaHa(initialData.defensivos[0]?.area_hectares || 0);
      }
    }
  }, [initialData]);

  useEffect(() => {
    setDefensivos((prev) =>
      prev.map((d) => ({
        ...d,
        total: (d.dose || 0) * (selectedAreaHa || 0),
      }))
    );
  }, [selectedAreaHa]);

  const handleAddDefensivo = () => {
    setDefensivos([
      ...defensivos,
      {
        tempId: crypto.randomUUID(),
        defensivo: "",
        dose: 0,
        unidade: "L/ha",
        alvo: "",
        aplicacoes: [],
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
          if (field === "dose") {
            const dose = value;
            updated.total = (dose || 0) * (selectedAreaHa || 0);
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

    const defensivosToSubmit = defensivos.map(({ tempId, total, aplicacoes, ...def }) => ({
      ...def,
      area_hectares: selectedAreaHa,
      alvo: aplicacoes && aplicacoes.length > 0 ? aplicacoes.join(", ") : def.alvo,
    }));
    onSubmit({ produtor_numerocm: produtorNumerocm, area, defensivos: defensivosToSubmit });
  };

  const selectedProdutor = produtores.find((p) => p.numerocm === produtorNumerocm);

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seção fixa */}
        <div className="grid gap-4 md:grid-cols-3">
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
                  {area ? (
                    <span className="flex items-center gap-2">
                      <span>{fazendas.find(f => f.nomefazenda === area)?.nomefazenda || area}</span>
                      {Number(selectedAreaHa || 0) > 0 ? (
                        <span className="text-xs text-muted-foreground">({Number(selectedAreaHa).toFixed(2)} ha)</span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">sem área(há)</Badge>
                      )}
                    </span>
                  ) : (
                    "Selecione uma fazenda..."
                  )}
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
                          onSelect={() => {
                            setArea(f.nomefazenda);
                            setSelectedAreaHa(Number(f.area_cultivavel || 0));
                            setOpenFazenda(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              area === f.nomefazenda ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex items-center gap-2">
                            <span>{f.nomefazenda}</span>
                            {Number(f.area_cultivavel || 0) > 0 ? (
                              <span className="text-xs text-muted-foreground">({Number(f.area_cultivavel || 0)} ha)</span>
                            ) : (
                              <Badge variant="secondary" className="text-xs">sem área(há)</Badge>
                            )}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Área cultivável (ha)</Label>
            <Input
              type="number"
              value={selectedAreaHa ? selectedAreaHa.toFixed(2) : "0.00"}
              disabled
              className="bg-muted"
            />
          </div>
        </div>

        {/* Seleção de classe/aplicação agora por produto (na linha) */}

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
              defensivosCatalog={(defensivosCatalog || [])}
              calendario={calendario}
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
  defensivosCatalog: Array<{ item: string | null; cod_item: string; marca: string | null; principio_ativo: string | null; grupo: string | null }>;
  calendario?: { classes: string[]; aplicacoesPorClasse: Record<string, string[]> } | undefined;
  onChange: (field: keyof Omit<DefensivoItem, "id">, value: any) => void;
  onRemove: () => void;
  canRemove: boolean;
};

// Normaliza texto: remove acentos e deixa em maiúsculas
const normalizeText = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

// Sinônimos/abreviações por classe (case/acentos serão normalizados na comparação)
const CLASS_SYNONYMS: Record<string, string[]> = {
  TS: ["TRAT. SEMENTES", "TRAT SEMENTES", "TRATAMENTO DE SEMENTES", "TRATAMENTO SEMENTES"],
  "TRAT. SEMENTES": ["TS", "TRAT SEMENTES", "TRATAMENTO DE SEMENTES", "TRATAMENTO SEMENTES"],
  "TRAT SEMENTES": ["TS", "TRAT. SEMENTES", "TRATAMENTO DE SEMENTES", "TRATAMENTO SEMENTES"],
};

const DefensivoRow = ({ defensivo, index, defensivosCatalog, calendario, onChange, onRemove, canRemove }: DefensivoRowProps) => {
  const [openDefensivoPopover, setOpenDefensivoPopover] = useState(false);
  const [openClassePopover, setOpenClassePopover] = useState(false);
  const [openAplicacoesPopover, setOpenAplicacoesPopover] = useState(false);
  const [selectedClasse, setSelectedClasse] = useState<string>("");
  const [selectedAplicacoes, setSelectedAplicacoes] = useState<string[]>(defensivo.aplicacoes || []);

  // Sincroniza selectedAplicacoes quando defensivo.aplicacoes mudar
  useEffect(() => {
    setSelectedAplicacoes(defensivo.aplicacoes || []);
  }, [defensivo.aplicacoes]);

  const filteredCatalog = (defensivosCatalog || []).filter((d: any) => {
    const cls = String(selectedClasse || "").trim();
    if (!cls) return true;

    const clsNorm = normalizeText(cls);
    // Quando classe = OUTROS, mostrar todos os produtos
    if (clsNorm === "OUTROS") return true;
    const synonyms = (CLASS_SYNONYMS[clsNorm] || []).map(normalizeText);
    const needles = [clsNorm, ...synonyms];

    const grupoNorm = normalizeText(d.grupo || "");
    const itemNorm = normalizeText(d.item || "");
    const marcaNorm = normalizeText(d.marca || "");
    const principioNorm = normalizeText(d.principio_ativo || "");

    // Match se o grupo for exatamente a classe/sinônimo OU se algum texto contiver a classe/sinônimo
    return needles.some((n) =>
      grupoNorm === n || itemNorm.includes(n) || marcaNorm.includes(n) || principioNorm.includes(n)
    );
  });

  return (
    <Card className="p-4 bg-muted/50">
      <div className="flex items-start gap-4">
        <div className="flex-1 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Descrição da Classe</Label>
            <Popover open={openClassePopover} onOpenChange={setOpenClassePopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {selectedClasse || "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar classe..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma classe encontrada.</CommandEmpty>
                    <CommandGroup>
                      {(calendario?.classes || []).map((cls) => (
                        <CommandItem
                          key={cls}
                          value={cls}
                          onSelect={() => {
                            setSelectedClasse(cls);
                            setSelectedAplicacoes([]);
                            onChange("aplicacoes", []);
                            setOpenClassePopover(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedClasse === cls ? "opacity-100" : "opacity-0")} />
                          {cls}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Descrição da Aplicação</Label>
            <Popover open={openAplicacoesPopover} onOpenChange={setOpenAplicacoesPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {selectedAplicacoes.length > 0 
                    ? `${selectedAplicacoes.length} selecionada(s)`
                    : selectedClasse 
                      ? "Selecione..." 
                      : "Selecione uma classe"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar aplicação..." />
                  <CommandList>
                    <CommandEmpty>
                      {selectedClasse ? "Nenhuma aplicação encontrada." : "Selecione uma classe primeiro."}
                    </CommandEmpty>
                    <CommandGroup>
                      {(calendario?.aplicacoesPorClasse?.[selectedClasse] || []).map((ap) => (
                        <CommandItem
                          key={ap}
                          value={ap}
                          onSelect={() => {
                            const newSelection = selectedAplicacoes.includes(ap)
                              ? selectedAplicacoes.filter(a => a !== ap)
                              : [...selectedAplicacoes, ap];
                            setSelectedAplicacoes(newSelection);
                            onChange("aplicacoes", newSelection);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedAplicacoes.includes(ap) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {ap}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

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
                      {filteredCatalog.map((def) => (
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

          {/* Campo de Unidade removido conforme solicitação; mantém valor padrão "L/ha" */}

          {/* Área por produto removida: usa-se a área da fazenda selecionada */}

          <div className="space-y-2 md:col-span-2">
            <Label>Total</Label>
            <Input
              type="number"
              step="0.01"
              value={defensivo.total?.toFixed(2) || "0.00"}
              disabled
              className="bg-muted"
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
