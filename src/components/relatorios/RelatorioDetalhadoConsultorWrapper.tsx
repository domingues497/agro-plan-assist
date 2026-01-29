import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProdutores } from "@/hooks/useProdutores";
import { useSafras } from "@/hooks/useSafras";
import { useEpocas } from "@/hooks/useEpocas";
import { useFazendas } from "@/hooks/useFazendas";
import { getApiBaseUrl } from "@/lib/utils";
import { Loader2, Download, Check, ChevronsUpDown, Printer } from "lucide-react";
import { DetailedReportItem, ProductItem, CultivarItem } from "./RelatorioDetalhadoPDF";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const RelatorioDetalhadoConsultorWrapper = () => {
  const [safraFilter, setSafraFilter] = useState<string>("");
  const [consultorFilter, setConsultorFilter] = useState<string>("");
  const [openConsultorCombobox, setOpenConsultorCombobox] = useState(false);

  const { data: produtores = [] } = useProdutores();
  const { safras = [] } = useSafras() as any;
  const { data: allFazendas = [] } = useFazendas();
  const { data: epocas = [] } = useEpocas();

  const consultores = useMemo(() => {
    const list = new Set<string>();
    produtores.forEach((p: any) => {
      if (p.consultor) list.add(p.consultor);
    });
    return Array.from(list).sort();
  }, [produtores]);

  const { data: detailedReportData = [], isLoading, refetch } = useQuery({
    queryKey: ["detailed-report-consultor", consultorFilter, safraFilter],
    enabled: false,
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const resProg = await fetch(`${baseUrl}/programacoes`, { headers });
      if (!resProg.ok) throw new Error("Erro ao carregar programações");
      const jsonProg = await resProg.json();
      const allProgramacoes = (jsonProg?.items ?? []) as any[];

      const filteredProgs = allProgramacoes.filter(p => {
        const prod = produtores.find((pr: any) => pr.numerocm === p.produtor_numerocm);
        const matchConsultor = prod && prod.consultor === consultorFilter;
        const matchSafra = !safraFilter || String(p.safra_id || "") === safraFilter;
        return matchConsultor && matchSafra;
      });

      const fazendaIds = Array.from(new Set(
        filteredProgs.map(p => {
          const fazenda = allFazendas.find((f: any) => f.idfazenda === p.fazenda_idfazenda && f.numerocm === p.produtor_numerocm);
          return fazenda ? fazenda.id : null;
        }).filter(Boolean)
      ));
      
      let talhoesMap: Record<string, { nome: string, area: number }> = {};
      
      if (fazendaIds.length > 0) {
        try {
          const resT = await fetch(`${baseUrl}/talhoes?ids=${fazendaIds.join(",")}`, { headers });
          if (resT.ok) {
            const jsonT = await resT.json();
            (jsonT?.items || []).forEach((t: any) => {
              let areaNum = 0;
              if (typeof t.area === 'string') {
                 areaNum = Number(t.area.replace(',', '.'));
              } else {
                 areaNum = Number(t.area || 0);
              }
              if (!Number.isFinite(areaNum)) areaNum = 0;

              talhoesMap[String(t.id)] = { nome: t.nome, area: areaNum };
            });
          }
        } catch (e) {
          console.error("Erro ao buscar talhoes", e);
        }
      }

      const promises = filteredProgs.map(async (prog) => {
        try {
          const res = await fetch(`${baseUrl}/programacoes/${prog.id}/children`, { headers });
          if (!res.ok) return null;
          const children = await res.json();
          
          const produtor = produtores.find((p: any) => p.numerocm === prog.produtor_numerocm);
          const fazenda = allFazendas.find((f: any) => f.idfazenda === prog.fazenda_idfazenda && f.numerocm === prog.produtor_numerocm);
          
          const talhoesIds = (children.talhoes || []).map((t: any) => typeof t === 'object' ? t.id : t);
          const talhoesNomesMap = children.talhoes_nomes || {};

          const cultivares = Array.isArray(children.cultivares) ? children.cultivares : [];
          
          const products: ProductItem[] = [];

          if (children.adubacao && Array.isArray(children.adubacao)) {
            children.adubacao.forEach((a: any) => {
              products.push({
                data: a.data_aplicacao ? new Date(a.data_aplicacao).toLocaleDateString('pt-BR') : "-",
                produto: a.formulacao || "-",
                quant_ha: a.dose ? a.dose.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-",
                total_kg: "0",
                area_aplicada: "0",
                proprio: a.fertilizante_salvo ? "Sim" : "Não",
                emb: a.embalagem || "-"
              });
            });
          }

          if (children.defensivos && Array.isArray(children.defensivos)) {
            children.defensivos.forEach((d: any) => {
              products.push({
                data: d.data_aplicacao ? new Date(d.data_aplicacao).toLocaleDateString('pt-BR') : (d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : "-"),
                produto: d.defensivo || "-",
                quant_ha: d.dose ? d.dose.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-",
                total_kg: "0",
                area_aplicada: "0",
                proprio: d.produto_salvo ? "Sim" : "Não",
                emb: d.embalagem || (d.unidade || "-")
              });
            });
          }

          products.sort((a, b) => {
             const dateA = a.data !== "-" ? new Date(a.data.split('/').reverse().join('-')).getTime() : 0;
             const dateB = b.data !== "-" ? new Date(b.data.split('/').reverse().join('-')).getTime() : 0;
             return dateA - dateB;
          });

          if (talhoesIds.length > 0) {
            return talhoesIds.map((tid: any) => {
              const talhaoData = talhoesMap[tid];
              const talhaoNome = talhoesNomesMap[tid] || (talhaoData ? talhaoData.nome : tid);
              const talhaoArea = talhaoData ? talhaoData.area : 0;
              
              const cultivaresItems: CultivarItem[] = cultivares.map((cultivar: any) => {
                  const percentual = cultivar?.percentual_cobertura ? Number(cultivar.percentual_cobertura) : 100;
                  const areaCalculada = talhaoArea > 0 ? (talhaoArea * percentual / 100) : 0;
                  
                  let tratamento = "-";
                  let tipoEspecifico = "-";
                  
                  if (cultivar) {
                      tratamento = cultivar.semente_propria ? "Na Fazenda" : "Industrial";
                      
                      if (cultivar.semente_propria) {
                          if (cultivar.defensivos_fazenda && cultivar.defensivos_fazenda.length > 0) {
                              tipoEspecifico = "SEMENTE COM TRATAMENTO (" + cultivar.defensivos_fazenda.map((d: any) => 
                                  `${d.defensivo}${d.dose ? ` (${d.dose} ${d.unidade || 'ml/kg'})` : ''}`
                              ).join(" + ") + ")";
                          }
                      } else {
                          if (cultivar.tratamento_nomes) {
                              tipoEspecifico = cultivar.tratamento_nomes;
                          } else if (cultivar.observacao) {
                              tipoEspecifico = cultivar.observacao;
                          }
                      }
                  }

                  return {
                      cultura: cultivar?.cultura || "SOJA", 
                      cultivar: cultivar?.cultivar || "-",
                      data_plantio: cultivar?.data_plantio ? new Date(cultivar.data_plantio).toLocaleDateString('pt-BR') : "-",
                      plantas_m2: cultivar?.populacao_recomendada ? String(cultivar.populacao_recomendada) : "-",
                      epoca: epocas.find((e: any) => String(e.id) === String(cultivar?.epoca_id))?.nome || "Plantio",
                      area_ha: areaCalculada > 0 ? areaCalculada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-",
                      propria: cultivar?.semente_propria ? "Sim" : "Não",
                      emb: cultivar?.unidade || (cultivar?.embalagem || "Bigbag"),
                      percent_plant: percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%",
                      tratamento: tratamento,
                      tipo_especifico: tipoEspecifico
                  };
              });

              const areaCobertaTalhao = (() => {
                const areas = cultivares.map((c: any) => {
                  const perc = c?.percentual_cobertura ? Number(c.percentual_cobertura) : 100;
                  const calc = talhaoArea > 0 ? (talhaoArea * perc / 100) : 0;
                  return Number.isFinite(calc) ? calc : 0;
                });
                const soma = areas.reduce((acc: number, a: number) => acc + a, 0);
                return Math.min(talhaoArea, soma);
              })();

              const talhaoProducts = products.map(p => {
                 const dose = parseFloat(p.quant_ha.replace(/\./g, '').replace(',', '.')) || 0;
                 const total = dose * areaCobertaTalhao;
                 return {
                   ...p,
                   total_kg: total.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
                   area_aplicada: areaCobertaTalhao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                 };
              });

              return {
                produtor: produtor?.nome || prog.produtor_numerocm,
                imovel: fazenda?.nomefazenda || prog.fazenda_idfazenda,
                gleba: talhaoNome,
                cultivares: cultivaresItems,
                produtos: talhaoProducts
              };
            });
          } else {
             return [{
              produtor: produtor?.nome || prog.produtor_numerocm,
              imovel: fazenda?.nomefazenda || prog.fazenda_idfazenda,
              gleba: "N/A",
              cultivares: cultivares.map((cultivar: any) => {
                  const percentual = cultivar?.percentual_cobertura ? Number(cultivar.percentual_cobertura) : 100;
                  const areaTotal = prog.area_hectares || 0;
                  const areaCalculada = areaTotal > 0 ? (areaTotal * percentual / 100) : 0;
                  
                  let tratamento = "-";
                  let tipoEspecifico = "-";
                  
                  if (cultivar) {
                      tratamento = cultivar.semente_propria ? "Na Fazenda" : "Industrial";
                      if (cultivar.semente_propria) {
                          if (cultivar.defensivos_fazenda && cultivar.defensivos_fazenda.length > 0) {
                              tipoEspecifico = "SEMENTE COM TRATAMENTO (" + cultivar.defensivos_fazenda.map((d: any) => 
                                  `${d.defensivo}${d.dose ? ` (${d.dose} ${d.unidade || 'ml/kg'})` : ''}`
                              ).join(" + ") + ")";
                          }
                      } else {
                          if (cultivar.tratamento_nomes) {
                              tipoEspecifico = cultivar.tratamento_nomes;
                          } else if (cultivar.observacao) {
                              tipoEspecifico = cultivar.observacao;
                          }
                      }
                  }

                  return {
                      cultura: cultivar?.cultura || "SOJA", 
                      cultivar: cultivar?.cultivar || "-",
                      data_plantio: cultivar?.data_plantio ? new Date(cultivar.data_plantio).toLocaleDateString('pt-BR') : "-",
                      plantas_m2: cultivar?.populacao_recomendada ? String(cultivar.populacao_recomendada) : "-",
                      epoca: epocas.find((e: any) => String(e.id) === String(cultivar?.epoca_id))?.nome || "Plantio",
                      area_ha: areaCalculada > 0 ? areaCalculada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-",
                      propria: cultivar?.semente_propria ? "Sim" : "Não",
                      emb: cultivar?.unidade || (cultivar?.embalagem || "Bigbag"),
                      percent_plant: percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%",
                      tratamento: tratamento,
                      tipo_especifico: tipoEspecifico
                  };
              }),
              produtos: products.map(p => {
                 const dose = parseFloat(p.quant_ha.replace(/\./g, '').replace(',', '.')) || 0;
                 const total = dose * (prog.area_hectares || 0);
                 return {
                   ...p,
                   total_kg: total.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
                   area_aplicada: (prog.area_hectares || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                 };
              })
             }];
          }
        } catch (e) {
          console.error("Erro ao processar programacao", e);
          return null;
        }
      });

      const resultsNested = await Promise.all(promises);
      return resultsNested.flat().filter(Boolean) as DetailedReportItem[];
    }
  });

  const handleGenerate = () => {
    if (consultorFilter) {
      refetch();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-2">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Filtros do Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">Safra</label>
              <Select value={safraFilter} onValueChange={setSafraFilter}>
                 <SelectTrigger>
                    <SelectValue placeholder="Selecione a Safra" />
                 </SelectTrigger>
                 <SelectContent>
                    {safras.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                 </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Consultor</label>
              <Popover open={openConsultorCombobox} onOpenChange={setOpenConsultorCombobox}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={openConsultorCombobox} className="w-full justify-between">
                    {consultorFilter
                      ? consultorFilter
                      : "Selecione o Consultor..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar consultor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum consultor encontrado.</CommandEmpty>
                      <CommandGroup>
                        {consultores.map((c) => (
                          <CommandItem
                            key={c}
                            value={c}
                            onSelect={() => {
                              setConsultorFilter(c);
                              setOpenConsultorCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                consultorFilter === c ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end gap-2 lg:col-span-3">
              <Button onClick={handleGenerate} disabled={isLoading || !consultorFilter} className="w-full md:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gerar Relatório
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {detailedReportData && detailedReportData.length > 0 && (
        <div className="space-y-8 print:p-0">
          <div className="flex justify-between items-center print:hidden">
            <h2 className="text-2xl font-bold">Resultados</h2>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </div>

          <div className="hidden print:block mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Relatório Detalhado por Consultor</h1>
            <p className="text-gray-600">Consultor: {consultorFilter} | Safra: {safras.find((s:any) => s.id === safraFilter)?.nome}</p>
          </div>

          <div className="space-y-6">
            {detailedReportData.map((item, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-white shadow-sm break-inside-avoid">
                <div className="mb-4 pb-2 border-b">
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold">{item.produtor}</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm text-gray-600 mt-2">
                    <span><strong>Fazenda:</strong> {item.imovel}</span>
                    <span><strong>Talhão:</strong> {item.gleba}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Cultivares */}
                  <div className="bg-green-50/50 p-3 rounded">
                    <h3 className="text-sm font-semibold text-green-800 mb-3">Cultivares</h3>
                    <div className="space-y-3">
                      {item.cultivares.map((c, i) => (
                        <div key={i} className="text-sm border-b border-green-100 pb-2 last:border-0">
                          <div className="font-medium">{c.cultivar} ({c.cultura})</div>
                          <div className="grid grid-cols-2 gap-1 mt-1 text-xs text-gray-700">
                            <span><strong>Área:</strong> {c.area_ha} ha</span>
                            <span><strong>Plantio:</strong> {c.data_plantio}</span>
                            <span><strong>Pop:</strong> {c.plantas_m2}</span>
                            <span><strong>Tratamento:</strong> {c.tratamento}</span>
                          </div>
                          {c.tipo_especifico !== "-" && (
                            <div className="text-xs text-gray-500 mt-1 italic">{c.tipo_especifico}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Produtos */}
                  <div className="bg-yellow-50/50 p-3 rounded">
                    <h3 className="text-sm font-semibold text-yellow-800 mb-3">Insumos (Adubos/Defensivos)</h3>
                    <div className="space-y-3">
                      {item.produtos.map((p, i) => (
                        <div key={i} className="text-sm border-b border-yellow-100 pb-2 last:border-0">
                          <div className="font-medium">{p.produto}</div>
                          <div className="grid grid-cols-2 gap-1 mt-1 text-xs text-gray-700">
                            <span><strong>Data:</strong> {p.data}</span>
                            <span><strong>Dose:</strong> {p.quant_ha}</span>
                            <span><strong>Total:</strong> {p.total_kg}</span>
                            <span><strong>Área:</strong> {p.area_aplicada} ha</span>
                          </div>
                        </div>
                      ))}
                      {item.produtos.length === 0 && (
                        <p className="text-xs text-gray-500 italic">Nenhum insumo registrado.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
