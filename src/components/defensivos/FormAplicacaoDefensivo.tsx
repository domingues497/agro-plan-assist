import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { cn, safeRandomUUID } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useProdutores } from "@/hooks/useProdutores";
import { useDefensivosCatalog } from "@/hooks/useDefensivosCatalog";
import { useCalendarioAplicacoes } from "@/hooks/useCalendarioAplicacoes";
import { useFazendas } from "@/hooks/useFazendas";
import type { DefensivoItem } from "@/hooks/useAplicacoesDefensivos";
import { useProgramacaoCultivares } from "@/hooks/useProgramacaoCultivares";
import { useSafras } from "@/hooks/useSafras";
import { supabase } from "@/integrations/supabase/client";
import { useProgramacoes } from "@/hooks/useProgramacoes";

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
  const { safras, defaultSafra } = useSafras();
  const [safraId, setSafraId] = useState<string>("");
  const [openSafra, setOpenSafra] = useState(false);
  
  const [defensivos, setDefensivos] = useState<Array<Omit<DefensivoItem, "id"> & { tempId: string; total?: number }>>([
    {
      tempId: safeRandomUUID(),
      defensivo: "",
      dose: 0,
      unidade: "L/ha",
      alvo: "",
      aplicacoes: [],
      produto_salvo: false,
      deve_faturar: true,
      porcentagem_salva: 100,
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
      const initialSafraId = initialData.defensivos?.[0]?.safra_id as any;
      if (initialSafraId) setSafraId(String(initialSafraId));
      if (initialData.defensivos && initialData.defensivos.length > 0) {
        setDefensivos(
          initialData.defensivos.map((def) => ({
            ...def,
            tempId: safeRandomUUID(),
            // Separar as aplicações concatenadas do campo alvo
            aplicacoes: def.alvo ? def.alvo.split(",").map(a => a.trim()) : [],
            porcentagem_salva: Math.min(100, Math.max(1, Number(def.porcentagem_salva ?? 100))),
            total: ( (Number(def.dose) || 0) * (Number(def.area_hectares) || 0) * (Math.min(100, Math.max(1, Number(def.porcentagem_salva ?? 100))) / 100) ),
          }))
        );
        setSelectedAreaHa(initialData.defensivos[0]?.area_hectares || 0);
      }
    }
  }, [initialData]);

  // Ao abrir nova aplicação, selecionar automaticamente a safra padrão do banco
  useEffect(() => {
    if (!initialData && !safraId && defaultSafra) {
      setSafraId(String(defaultSafra.id));
    }
  }, [defaultSafra, initialData, safraId]);

  // Fallback adicional: se não houver padrão explícito, escolher primeira ativa ou a primeira da lista
  useEffect(() => {
    if (initialData || safraId) return;
    const list = safras || [];
    if (!list.length) return;
    const candidate = defaultSafra
      || list.find((s: any) => s?.is_default)
      || list.find((s: any) => s?.ativa)
      || list[0];
    if (candidate?.id) {
      setSafraId(String(candidate.id));
    }
  }, [safras, defaultSafra, initialData, safraId]);

  useEffect(() => {
    setDefensivos((prev) =>
      prev.map((d) => ({
        ...d,
        total: ( (Number(d.dose) || 0) * (selectedAreaHa || 0) * ( (Math.min(100, Math.max(1, Number(d.porcentagem_salva ?? 100))) ) / 100) ),
      }))
    );
  }, [selectedAreaHa]);

  const handleAddDefensivo = () => {
    setDefensivos([
      ...defensivos,
      {
        tempId: safeRandomUUID(),
        classe: "",
        defensivo: "",
        dose: 0,
        unidade: "L/ha",
        alvo: "",
        aplicacoes: [],
        produto_salvo: false,
        deve_faturar: true,
        porcentagem_salva: 100,
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
    setDefensivos((prev) =>
      prev.map((d) => {
        if (d.tempId === tempId) {
          const updated = { ...d, [field]: value } as Omit<DefensivoItem, "id"> & { tempId: string };
          if (field === "porcentagem_salva") {
            const coberturaRaw = parseFloat(value);
            const cobertura = isNaN(coberturaRaw) ? 100 : Math.min(100, Math.max(0, coberturaRaw));
            updated.porcentagem_salva = cobertura as any;
          }
          if (field === "dose" || field === "porcentagem_salva") {
            const dose = Number(field === "dose" ? value : (updated as any).dose) || 0;
            const cobertura = Math.min(100, Math.max(0, Number((updated as any).porcentagem_salva ?? 100)));
            (updated as any).total = dose * (selectedAreaHa || 0) * (cobertura / 100);
          }
          return updated;
        }
        return d;
      })
    );
  };

  // Mapa de defensivos já selecionados por aplicação (para evitar duplicados na mesma aplicação)
  const existingByAplicacao = useMemo(() => {
    const map: Record<string, string[]> = {};
    defensivos.forEach((d) => {
      const ap = (d.aplicacoes && d.aplicacoes[0]) || d.alvo || "";
      const key = String(ap || "").trim();
      const name = String(d.defensivo || "").trim();
      if (!key || !name) return;
      if (!map[key]) map[key] = [];
      map[key].push(name);
    });
    return map;
  }, [defensivos]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!safraId) {
      alert("Selecione a Safra antes do Produtor/Fazenda");
      return;
    }
    if (!produtorNumerocm || !area) {
      alert("Por favor, preencha Produtor e Fazenda");
      return;
    }

    // Regra de negócio: bloquear se não existir programação de cultivar para produtor/fazenda
    if (!hasCultivarProgram) {
      alert("Não é possível cadastrar defensivos antes de registrar a programação de Cultivar para este produtor/fazenda.");
      return;
    }

    // Validação: ao invés de checar area_hectares em cada linha (que é populada apenas no submit),
    // usamos a área selecionada globalmente (selectedAreaHa) e validamos dose e defensivo por linha.
    if (
      defensivos.length === 0 ||
      Number(selectedAreaHa) <= 0 ||
      defensivos.some((d) => !d.defensivo || Number(d.dose) <= 0)
    ) {
      alert("Por favor, adicione pelo menos um defensivo válido com dose e área");
      return;
    }

    const defensivosToSubmit = defensivos.map(({ tempId, total, aplicacoes, ...def }) => ({
      ...def,
      safra_id: safraId,
      area_hectares: selectedAreaHa,
      alvo: aplicacoes && aplicacoes.length > 0 ? aplicacoes.join(", ") : def.alvo,
    }));
    onSubmit({ produtor_numerocm: produtorNumerocm, area, defensivos: defensivosToSubmit });
  };

  const selectedProdutor = produtores.find((p) => p.numerocm === produtorNumerocm);
  const { programacoes: cultProgramacoes = [], isLoading: isCultLoading } = useProgramacaoCultivares();
  const { programacoes: programacoesMain = [] } = useProgramacoes();
  
  // Busca a programação principal correspondente ao produtor/fazenda/safra selecionados
  const programacaoMain = useMemo(() => {
    if (!produtorNumerocm || !area || !safraId) return null;
    
    // Busca a fazenda pelo nome para pegar o idfazenda
    const fazenda = (fazendas || []).find(f => f.nomefazenda === area);
    if (!fazenda) return null;
    
    return (programacoesMain || []).find(
      (p) =>
        p.produtor_numerocm === produtorNumerocm &&
        p.fazenda_idfazenda === fazenda.idfazenda &&
        (p.safra_id ? String(p.safra_id) === String(safraId) : true)
    ) || null;
  }, [programacoesMain, produtorNumerocm, area, safraId, fazendas]);

  // Verifica se existe programação de cultivar
  const hasCultivarProgram = useMemo(() => {
    if (!produtorNumerocm || !area || !safraId) return false;
    const a = String(area || "").trim();
    const cm = String(produtorNumerocm || "").trim();
    const s = String(safraId || "").trim();
    return (cultProgramacoes || []).some(
      (p) =>
        String(p.produtor_numerocm || "").trim() === cm &&
        String(p.area || "").trim() === a &&
        String(p.safra || "").trim() === s
    );
  }, [cultProgramacoes, produtorNumerocm, area, safraId]);

  // Busca a área programada (soma dos talhões da programação)
  useEffect(() => {
    if (!programacaoMain?.id) {
      return;
    }

    const fetchAreaProgramada = async () => {
      try {
        const { data: areaTotalData } = await supabase.rpc('get_programacao_area_total', {
          programacao_uuid: programacaoMain.id
        });
        
        if (areaTotalData) {
          setSelectedAreaHa(Number(areaTotalData));
        }
      } catch (error) {
        console.error("Erro ao buscar área programada:", error);
      }
    };

    fetchAreaProgramada();
  }, [programacaoMain]);

  const allowedProdutoresNumerocm = useMemo(() => {
    if (!safraId) return [] as string[];
    const s = String(safraId);
    const set = new Set<string>((cultProgramacoes || [])
      .filter((p) => String(p.safra || "") === s)
      .map((p) => String(p.produtor_numerocm || ""))
    );
    return Array.from(set);
  }, [cultProgramacoes, safraId]);

  const produtoresFiltrados = useMemo(() => {
    if (!safraId) return [] as typeof produtores;
    const base = (produtores || []);
    const filtered = base.filter((p) => allowedProdutoresNumerocm.includes(String(p.numerocm)));
    return filtered;
  }, [produtores, allowedProdutoresNumerocm, safraId]);

  const allowedAreasSet = useMemo(() => {
    const set = new Set<string>();
    if (safraId && produtorNumerocm) {
      const s = String(safraId);
      const cm = String(produtorNumerocm);
      (cultProgramacoes || [])
        .filter((p) => String(p.safra || "") === s && String(p.produtor_numerocm || "") === cm)
        .forEach((p) => set.add(String(p.area || "")));
    }
    return set;
  }, [cultProgramacoes, safraId, produtorNumerocm]);

  const fazendasFiltradas = useMemo(() => {
    if (!safraId || !produtorNumerocm) return [] as NonNullable<typeof fazendas>;
    const base = (fazendas || []);
    const filtered = base.filter((f) => allowedAreasSet.has(String(f.nomefazenda)));
    return filtered;
  }, [fazendas, allowedAreasSet, safraId, produtorNumerocm]);

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Alerta de regra de negócio */}
        {produtorNumerocm && area && !isCultLoading && !hasCultivarProgram && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            Não é possível cadastrar defensivos antes de registrar a programação de Cultivar para este produtor/fazenda.
          </div>
        )}
        {/* Seção fixa */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Safra *</Label>
            <Popover open={openSafra} onOpenChange={setOpenSafra}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {safraId ? `${(safras || []).find((s) => String(s.id) === String(safraId))?.nome || "Selecionada"}` : "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar safra..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma safra encontrada.</CommandEmpty>
                    <CommandGroup>
                      {(safras || []).map((s) => (
                        <CommandItem
                          key={String(s.id)}
                          value={`${s.nome}`}
                          onSelect={() => {
                            setSafraId(String(s.id));
                            // reset produtor/fazenda ao trocar safra
                            setProdutorNumerocm("");
                            setArea("");
                            setSelectedAreaHa(0);
                            setOpenSafra(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              String(safraId) === String(s.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {s.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Produtor *</Label>
            <Popover open={openProdutorPopover} onOpenChange={setOpenProdutorPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between" disabled={!safraId}>
                  {selectedProdutor ? `${selectedProdutor.numerocm} - ${selectedProdutor.nome}` : "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar produtor..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produtor com Cultivar nesta safra.</CommandEmpty>
                    <CommandGroup>
                      {(produtoresFiltrados || []).map((produtor) => (
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
                  disabled={!produtorNumerocm || !safraId}
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
                    <CommandEmpty>Nenhuma fazenda com Cultivar nesta safra.</CommandEmpty>
                    <CommandGroup>
                      {(fazendasFiltradas || []).map((f) => (
                        <CommandItem
                          key={f.id}
                          value={f.nomefazenda}
                          onSelect={() => {
                            setArea(f.nomefazenda);
                            // A área será calculada via useEffect quando programacaoAtual mudar
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
              existingByAplicacao={existingByAplicacao}
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
          <Button type="submit" disabled={isLoading || (!isCultLoading && !hasCultivarProgram)}>
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
  existingByAplicacao: Record<string, string[]>;
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

// Normaliza texto removendo pluralidade (S no final) para comparação
const normalizeWithoutPlural = (s: string) => {
  const normalized = normalizeText(s);
  // Remove 'S' no final se a palavra tiver mais de 3 caracteres
  return normalized.length > 3 && normalized.endsWith('S') 
    ? normalized.slice(0, -1) 
    : normalized;
};

// Sinônimos/abreviações por classe (case/acentos serão normalizados na comparação)
const CLASS_SYNONYMS: Record<string, string[]> = {
  TS: ["TRAT. SEMENTES", "TRAT SEMENTES", "TRATAMENTO DE SEMENTES", "TRATAMENTO SEMENTES"],
  "TRAT. SEMENTES": ["TS", "TRAT SEMENTES", "TRATAMENTO DE SEMENTES", "TRATAMENTO SEMENTES"],
  "TRAT SEMENTES": ["TS", "TRAT. SEMENTES", "TRATAMENTO DE SEMENTES", "TRATAMENTO SEMENTES"],
};

// Aplicações que não devem aparecer na programação de defensivos
const EXCLUDED_APLICACOES = new Set<string>([
  normalizeText("Tratamento de Semente - TS"),
]);

const DefensivoRow = ({ defensivo, index, defensivosCatalog, calendario, existingByAplicacao, onChange, onRemove, canRemove }: DefensivoRowProps) => {
  const [openDefensivoPopover, setOpenDefensivoPopover] = useState(false);
  const [openClassePopover, setOpenClassePopover] = useState(false);
  const [openAplicacoesPopover, setOpenAplicacoesPopover] = useState(false);
  const [selectedClasse, setSelectedClasse] = useState<string>("");
  const [selectedAplicacoes, setSelectedAplicacoes] = useState<string[]>(defensivo.aplicacoes || []);

  // Sincroniza selectedAplicacoes quando defensivo.aplicacoes mudar
  useEffect(() => {
    setSelectedAplicacoes(defensivo.aplicacoes || []);
  }, [defensivo.aplicacoes]);

  // Inicializa a classe ao editar, inferindo primeiro pelo catálogo do defensivo,
  // depois por aplicacoes e por fim pelo alvo
  useEffect(() => {
    // Se já veio salvo, priorizar o valor persistido
    if (defensivo.classe && defensivo.classe.trim()) {
      setSelectedClasse(defensivo.classe);
      return;
    }
    if (selectedClasse) return; // não sobrescrever se já houve seleção

    const classes = Object.keys(calendario?.aplicacoesPorClasse || {});

    // 1) Tentar identificar a classe pelo catálogo do defensivo selecionado
    const defName = String(defensivo.defensivo || "").trim();
    if (defName) {
      const match = (defensivosCatalog || []).find((d) => normalizeText(String(d.item || "")) === normalizeText(defName));
      const grupo = String(match?.grupo || "").trim();
      if (grupo) {
        setSelectedClasse(grupo);
        onChange("classe", grupo);
        return;
      }
      // 1b) Se não encontrou no catálogo, tentar extrair prefixo antes de "-"
      const prefix = defName.split("-")[0]?.trim();
      if (prefix) {
        const prefixNorm = normalizeWithoutPlural(prefix);
        const clsFromPrefix = classes.find((c) => normalizeWithoutPlural(c) === prefixNorm);
        if (clsFromPrefix) {
          setSelectedClasse(clsFromPrefix);
          onChange("classe", clsFromPrefix);
          return;
        }
      }
    }

    // 2) Em seguida, inferir pela primeira aplicação selecionada
    if (defensivo.aplicacoes && defensivo.aplicacoes.length > 0) {
      const firstAp = defensivo.aplicacoes[0];
      const cls = classes.find((c) =>
        (calendario?.aplicacoesPorClasse?.[c] || []).some((ap) => normalizeWithoutPlural(ap) === normalizeWithoutPlural(firstAp))
      );
      if (cls) {
        setSelectedClasse(cls);
        onChange("classe", cls);
        return;
      }
    }

    // 3) Por fim, inferir pelo alvo com match exato
    const alvo = String(defensivo.alvo || "").trim();
    if (alvo) {
      const alvoNorm = normalizeWithoutPlural(alvo);
      const cls = classes.find((c) =>
        (calendario?.aplicacoesPorClasse?.[c] || []).some((ap) => normalizeWithoutPlural(ap) === alvoNorm)
      );
      if (cls) {
        setSelectedClasse(cls);
        onChange("classe", cls);
      }
    }
  }, [defensivo.classe, defensivo.defensivo, defensivo.aplicacoes, defensivo.alvo, calendario, selectedClasse, defensivosCatalog, onChange]);

  console.log('📦 Total items in catalog:', defensivosCatalog?.length);
  console.log('🎯 Selected class:', selectedClasse);
  
  // Debug: quantos INSETICIDA existem no catálogo original?
  const inseticidasCount = defensivosCatalog?.filter((d: any) => d.grupo === 'INSETICIDA').length || 0;
  console.log('🔢 Items com grupo="INSETICIDA" no catálogo original:', inseticidasCount);
  
  const filteredCatalog = (defensivosCatalog || []).filter((d: any) => {
    const cls = String(selectedClasse || "").trim();
    if (!cls) return true;

    const clsNorm = normalizeWithoutPlural(cls);
    const grupoNorm = normalizeWithoutPlural(d.grupo || "");
    
    // Log detalhado para INSETICIDA
    if (d.grupo === 'INSETICIDA') {
      console.log('🐛 Debug INSETICIDA:', {
        grupo_original: d.grupo,
        cls_original: cls,
        clsNorm,
        grupoNorm,
        equal: clsNorm === grupoNorm,
        item: d.item
      });
    }
    
    // Também tentar match sem remover plural
    const clsNormOriginal = normalizeText(cls);
    const grupoNormOriginal = normalizeText(d.grupo || "");

    // Regra: somente itens cujo grupo == classe selecionada
    // Tenta match com e sem plural
    const matchesClasse = 
      clsNorm === "OUTRO" ? (grupoNorm === "" || grupoNorm === "OUTRO") :
      (grupoNorm === clsNorm || grupoNormOriginal === clsNormOriginal);

    if (matchesClasse && d.grupo === 'INSETICIDA') {
      console.log('✅ MATCH INSETICIDA:', d.item);
    }

    if (!matchesClasse) return false;

    // Evitar duplicados na mesma aplicação: se já existe um defensivo com o mesmo "core"
    const apKey = String((selectedAplicacoes[0] || defensivo.alvo || "").trim());
    if (!apKey) return true;
    const existing = (existingByAplicacao[apKey] || [])
      .map((n) => normalizeText(String(n || "").replace(/%/g, "")))
      .filter((n) => n && n !== normalizeText(defensivo.defensivo || ""));

    // Remover prefixo da classe do nome existente para comparar núcleo (ex.: "HERBICIDA DUAL GOLD" -> "DUAL GOLD")
    const clsPrefix = clsNorm + " ";
    const cores = existing.map((n) => (n.startsWith(clsPrefix) ? n.slice(clsPrefix.length).trim() : n));

    // Normalizar item e marca do defensivo atual para comparação
    const itemNorm = normalizeText(d.item || "");
    const marcaNorm = normalizeText(d.marca || "");

    const isDuplicateByItem = cores.some((core) => core && itemNorm.includes(core));
    const isDuplicateByMarca = cores.some((core) => core && marcaNorm.includes(core));

    if (isDuplicateByItem || isDuplicateByMarca) return false;
    return true;
  });

  console.log('🎲 Filtered catalog length:', filteredCatalog.length);

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
                            onChange("alvo", "");
                            onChange("classe", cls);
                            onChange("defensivo", "");
                            onChange("dose", 0);
                            onChange("porcentagem_salva", 0);
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
                    ? selectedAplicacoes[0]
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
                      {((calendario?.aplicacoesPorClasse?.[selectedClasse] || [])
                        .filter((ap) => !EXCLUDED_APLICACOES.has(normalizeText(ap)))
                      ).map((ap) => (
                        <CommandItem
                          key={ap}
                          value={ap}
                          onSelect={() => {
                            // Seleção única: alterna entre nenhuma e a aplicação escolhida
                            const newSelection = selectedAplicacoes.includes(ap) ? [] : [ap];
                            setSelectedAplicacoes(newSelection);
                            onChange("aplicacoes", newSelection);
                            onChange("alvo", newSelection[0] ?? "");
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

          <div className="space-y-2">
            <Label>Cobertura em %</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={defensivo.porcentagem_salva ?? 100}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                const val = isNaN(raw) ? 100 : Math.min(100, Math.max(0, raw));
                onChange("porcentagem_salva", val);
              }}
              placeholder="100"
            />
          </div>

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
