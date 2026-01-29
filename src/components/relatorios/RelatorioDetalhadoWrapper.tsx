import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProdutores } from "@/hooks/useProdutores";
import { useSafras } from "@/hooks/useSafras";
import { useEpocas } from "@/hooks/useEpocas";
import { useFazendas } from "@/hooks/useFazendas";
import { getApiBaseUrl } from "@/lib/utils";
import { Loader2, Download, Check, ChevronsUpDown } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioDetalhadoPDF, DetailedReportItem, ProductItem, CultivarItem } from "./RelatorioDetalhadoPDF";
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

export const RelatorioDetalhadoWrapper = () => {
  const [safraFilter, setSafraFilter] = useState<string>("");
  const [produtorFilter, setProdutorFilter] = useState<string>("");
  const [openCombobox, setOpenCombobox] = useState(false);

  const { data: produtores = [] } = useProdutores();
  const { safras = [] } = useSafras() as any;
  const { data: allFazendas = [] } = useFazendas();
  const { data: epocas = [] } = useEpocas();

  const { data: detailedReportData = [], isLoading, refetch } = useQuery({
    queryKey: ["detailed-report", produtorFilter, safraFilter],
    enabled: false,
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch all programacoes - ideally this should be filtered by backend
      const resProg = await fetch(`${baseUrl}/programacoes`, { headers });
      if (!resProg.ok) throw new Error("Erro ao carregar programações");
      const jsonProg = await resProg.json();
      const allProgramacoes = (jsonProg?.items ?? []) as any[];

      const filteredProgs = allProgramacoes.filter(p => {
        const matchProdutor = p.produtor_numerocm === produtorFilter;
        const matchSafra = !safraFilter || String(p.safra_id || "") === safraFilter;
        return matchProdutor && matchSafra;
      });

      const fazendaIds = Array.from(new Set(
        filteredProgs.map(p => {
          const fazenda = allFazendas.find(f => f.idfazenda === p.fazenda_idfazenda && f.numerocm === p.produtor_numerocm);
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
    if (produtorFilter) {
      refetch();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <label className="text-sm font-medium">Produtor</label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={openCombobox} className="w-full justify-between">
                    {produtorFilter
                      ? produtores.find((p: any) => p.numerocm === produtorFilter)?.nome
                      : "Selecione o Produtor..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar produtor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum produtor encontrado.</CommandEmpty>
                      <CommandGroup>
                        {produtores.map((produtor: any) => (
                          <CommandItem
                            key={produtor.id}
                            value={produtor.nome}
                            onSelect={() => {
                              setProdutorFilter(produtor.numerocm);
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                produtorFilter === produtor.numerocm ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {produtor.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleGenerate} disabled={isLoading || !produtorFilter} className="flex-1">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gerar Relatório
              </Button>
              
              {detailedReportData && detailedReportData.length > 0 && (
                <PDFDownloadLink
                  document={<RelatorioDetalhadoPDF data={detailedReportData} />}
                  fileName={`relatorio_detalhado_${produtorFilter}_${new Date().toISOString().slice(0, 10)}.pdf`}
                  className="flex-1"
                >
                  {({ blob, url, loading, error }) => (
                    <Button variant="outline" disabled={loading} className="w-full">
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      {loading ? "Gerando PDF..." : "Baixar PDF"}
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
