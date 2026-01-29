import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProdutores } from "@/hooks/useProdutores";
import { useSafras } from "@/hooks/useSafras";
import { useEpocas } from "@/hooks/useEpocas";
import { useFazendas } from "@/hooks/useFazendas";
import { getApiBaseUrl } from "@/lib/utils";
import { Loader2, Printer, Check, ChevronsUpDown } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProductItem {
  data: string;
  produto: string;
  quant_ha: string;
  total_kg: string;
  area_aplicada: string;
  proprio: string;
  emb: string;
}

interface CultivarItem {
  cultura: string;
  cultivar: string;
  data_plantio: string;
  plantas_m2: string;
  epoca: string;
  area_ha: string;
  propria: string;
  emb: string;
  tratamento: string;
  tipo_especifico: string;
  percent_plant: string;
}

interface DetailedReportItem {
  produtor: string;
  imovel: string;
  gleba: string;
  cultivares: CultivarItem[];
  produtos: ProductItem[];
}

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
            <div className="flex items-end gap-2 lg:col-span-3">
              <Button onClick={handleGenerate} disabled={isLoading || !produtorFilter} className="w-full md:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gerar Relatório
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {detailedReportData && detailedReportData.length > 0 && (
        <div className="space-y-8 print:p-0">
           <div className="hidden print:block mb-8 text-center">
             <h1 className="text-3xl font-bold mb-2">Relatório Detalhado</h1>
             <p className="text-gray-600">
               {produtorFilter ? `Produtor: ${produtores.find((p: any) => p.numerocm === produtorFilter)?.nome || produtorFilter}` : "Todos os Produtores"}
               {safraFilter ? ` | Safra: ${safras.find((s: any) => String(s.id) === safraFilter)?.nome || safraFilter}` : ""}
             </p>
           </div>

           <div className="flex justify-between items-center print:hidden">
             <h2 className="text-2xl font-bold">Resultados ({detailedReportData.length})</h2>
             <Button variant="outline" onClick={handlePrint}>
               <Printer className="mr-2 h-4 w-4" /> Imprimir
             </Button>
           </div>
           
           <div className="space-y-6">
             {detailedReportData.map((item, index) => (
               <Card key={index} className="break-inside-avoid">
                 <CardHeader className="pb-2 bg-muted/20">
                   <div className="flex justify-between items-center flex-wrap gap-2">
                     <CardTitle className="text-base md:text-lg">
                       Imóvel: <span className="font-normal">{item.imovel}</span>
                     </CardTitle>
                     <CardTitle className="text-base md:text-lg">
                       Talhão: <span className="font-normal">{item.gleba}</span>
                     </CardTitle>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-4">
                    {/* Cultivares */}
                    {item.cultivares.map((cult, cIdx) => (
                        <div key={cIdx} className="mb-6 last:mb-0 border-b last:border-0 pb-4 last:pb-0">
                            <div className="bg-blue-50 text-blue-900 p-2 rounded mb-2 font-medium flex justify-between items-center">
                                <span>{cult.cultura} - {cult.cultivar}</span>
                                <span className="text-sm">Área: {cult.area_ha} ha ({cult.percent_plant})</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-2 px-2">
                                <div><span className="text-muted-foreground block text-xs">Data Plantio</span> {cult.data_plantio}</div>
                                <div><span className="text-muted-foreground block text-xs">População</span> {cult.plantas_m2}</div>
                                <div><span className="text-muted-foreground block text-xs">Época</span> {cult.epoca}</div>
                                <div><span className="text-muted-foreground block text-xs">Semente Própria</span> {cult.propria}</div>
                            </div>
                            <div className="text-sm mb-2 px-2">
                                <span className="text-muted-foreground">Tratamento:</span> {cult.tratamento}
                                {cult.tipo_especifico !== '-' && (
                                    <div className="mt-1 font-medium bg-yellow-50 p-1 rounded text-yellow-900 text-xs">{cult.tipo_especifico}</div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {/* Produtos Table */}
                    {item.produtos.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                            <h4 className="font-medium mb-2 text-sm uppercase text-muted-foreground">Insumos Aplicados</h4>
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="h-8 text-xs">Data</TableHead>
                                            <TableHead className="h-8 text-xs">Produto</TableHead>
                                            <TableHead className="h-8 text-xs text-right">Dose/ha</TableHead>
                                            <TableHead className="h-8 text-xs text-right">Total (Kg/L)</TableHead>
                                            <TableHead className="h-8 text-xs text-right">Área Apl.</TableHead>
                                            <TableHead className="h-8 text-xs">Emb.</TableHead>
                                            <TableHead className="h-8 text-xs">Próprio</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {item.produtos.map((prod, pIdx) => (
                                            <TableRow key={pIdx} className="hover:bg-muted/30">
                                                <TableCell className="py-2 text-xs">{prod.data}</TableCell>
                                                <TableCell className="py-2 text-xs font-medium">{prod.produto}</TableCell>
                                                <TableCell className="py-2 text-xs text-right">{prod.quant_ha}</TableCell>
                                                <TableCell className="py-2 text-xs text-right">{prod.total_kg}</TableCell>
                                                <TableCell className="py-2 text-xs text-right">{prod.area_aplicada}</TableCell>
                                                <TableCell className="py-2 text-xs">{prod.emb}</TableCell>
                                                <TableCell className="py-2 text-xs">{prod.proprio}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                 </CardContent>
               </Card>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
