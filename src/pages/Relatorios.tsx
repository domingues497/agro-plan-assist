import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft, Download, FileDown, Check, ChevronsUpDown } from "lucide-react";
import { useProgramacaoCultivares } from "@/hooks/useProgramacaoCultivares";
import { useProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { useAplicacoesDefensivos } from "@/hooks/useAplicacoesDefensivos";
import { useSafras } from "@/hooks/useSafras";
import { useFazendas } from "@/hooks/useFazendas";
import { useTalhoesMultiFazendas } from "@/hooks/useTalhoes";
import { useProdutores } from "@/hooks/useProdutores";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioPDF } from "@/components/relatorios/RelatorioPDF";
import { useProgramacoes } from "@/hooks/useProgramacoes";
import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl, cn } from "@/lib/utils";
import { RelatorioDetalhadoPDF, DetailedReportItem, ProductItem, CultivarItem } from "@/components/relatorios/RelatorioDetalhadoPDF";
import { RelatorioDetalhadoConsultorPDF } from "@/components/relatorios/RelatorioDetalhadoConsultorPDF";
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

const parseNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const Relatorios = () => {
  const { programacoes: cultivares } = useProgramacaoCultivares();
  const { programacoes: adubacoes } = useProgramacaoAdubacao();
  const { aplicacoes: defensivos } = useAplicacoesDefensivos();
  const { safras = [] } = useSafras() as any;
  const { data: produtores = [] } = useProdutores();
  const { programacoes: allProgramacoes } = useProgramacoes();
  const { data: allFazendas = [] } = useFazendas();
  const [safraFilter, setSafraFilter] = useState<string>("");
  const [produtorFilter, setProdutorFilter] = useState<string>("");
  const [openCombobox, setOpenCombobox] = useState(false);
  const [consultorFilter, setConsultorFilter] = useState<string>("");
  const [openConsultorCombobox, setOpenConsultorCombobox] = useState(false);

  const consultores = useMemo(() => {
    const list = new Set<string>();
    produtores.forEach(p => {
      if (p.consultor) list.add(p.consultor);
    });
    return Array.from(list).sort();
  }, [produtores]);

  // Fetch detailed data for the selected produtor
  const { data: detailedReportData = [], isLoading: loadingDetailed } = useQuery({
    queryKey: ["detailed-report", produtorFilter, safraFilter],
    enabled: !!produtorFilter,
    queryFn: async () => {
      const filteredProgs = allProgramacoes.filter(p => {
        const matchProdutor = p.produtor_numerocm === produtorFilter;
        const matchSafra = !safraFilter || String(p.safra_id || "") === safraFilter;
        return matchProdutor && matchSafra;
      });

      const results: DetailedReportItem[] = [];
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const baseUrl = getApiBaseUrl();

      // Pre-fetch all talhoes for the produtor's fazendas to avoid N+1 on talhoes list?
      // We need to map from fazenda_idfazenda (external code) to fazenda.id (internal UUID) because talhoes are linked by UUID
      const fazendaIds = Array.from(new Set(
        filteredProgs.map(p => {
          const fazenda = allFazendas.find(f => f.idfazenda === p.fazenda_idfazenda && f.numerocm === p.produtor_numerocm);
          return fazenda ? fazenda.id : null;
        }).filter(Boolean)
      ));
      
      let talhoesMap: Record<string, { nome: string, area: number }> = {}; // id -> { nome, area }
      
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
          
          const produtor = produtores.find(p => p.numerocm === prog.produtor_numerocm);
          const fazenda = allFazendas.find(f => f.idfazenda === prog.fazenda_idfazenda && f.numerocm === prog.produtor_numerocm);
          
          // Get Talhoes names
          const talhoesIds = (children.talhoes || []) as string[];
          const talhoesNomesMap = children.talhoes_nomes || {};

          // Get Cultivares
          const cultivares = Array.isArray(children.cultivares) ? children.cultivares : [];
          
          // Build Products List
          const products: ProductItem[] = [];

          // Adubacoes
          if (children.adubacao && Array.isArray(children.adubacao)) {
            children.adubacao.forEach((a: any) => {
              products.push({
                data: a.data_aplicacao ? new Date(a.data_aplicacao).toLocaleDateString('pt-BR') : "-",
                produto: a.formulacao || "-",
                quant_ha: a.dose ? a.dose.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-",
                total_kg: "0", // Will be calculated per talhao
                area_aplicada: "0", // Will be set per talhao
                proprio: a.fertilizante_salvo ? "Sim" : "Não",
                emb: a.embalagem || "-"
              });
            });
          }

          // Defensivos
          if (children.defensivos && Array.isArray(children.defensivos)) {
            children.defensivos.forEach((d: any) => {
              products.push({
                data: d.data_aplicacao ? new Date(d.data_aplicacao).toLocaleDateString('pt-BR') : (d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : "-"),
                produto: d.defensivo || "-",
                quant_ha: d.dose ? d.dose.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-",
                total_kg: "0", // Will be calculated per talhao
                area_aplicada: "0", // Will be set per talhao
                proprio: d.produto_salvo ? "Sim" : "Não",
                emb: d.embalagem || (d.unidade || "-")
              });
            });
          }

          // Sort products by date
          products.sort((a, b) => {
             const dateA = a.data !== "-" ? new Date(a.data.split('/').reverse().join('-')).getTime() : 0;
             const dateB = b.data !== "-" ? new Date(b.data.split('/').reverse().join('-')).getTime() : 0;
             return dateA - dateB;
          });

          if (talhoesIds.length > 0) {
            return talhoesIds.map(tid => {
              const talhaoData = talhoesMap[tid];
              const talhaoNome = talhoesNomesMap[tid] || (talhaoData ? talhaoData.nome : tid);
              const talhaoArea = talhaoData ? talhaoData.area : 0;
              
              // Build Cultivares Items
              const cultivaresItems: CultivarItem[] = cultivares.map((cultivar: any) => {
                  const percentual = cultivar?.percentual_cobertura ? Number(cultivar.percentual_cobertura) : 100;
                  const areaCalculada = talhaoArea > 0 ? (talhaoArea * percentual / 100) : 0;
                  
                  // Determine Tratamento and Tipo Especifico
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
                      epoca: "Plantio",
                      area_ha: areaCalculada > 0 ? areaCalculada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-",
                      propria: cultivar?.semente_propria ? "Sim" : "Não",
                      emb: cultivar?.unidade || (cultivar?.embalagem || "Bigbag"),
                      percent_plant: percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%",
                      tratamento: tratamento,
                      tipo_especifico: tipoEspecifico
                  };
              });

              // Área coberta no talhão considerando todas as cultivares (limitada ao tamanho do talhão)
              const areaCobertaTalhao = (() => {
                const areas = cultivares.map((c: any) => {
                  const perc = c?.percentual_cobertura ? Number(c.percentual_cobertura) : 100;
                  const calc = talhaoArea > 0 ? (talhaoArea * perc / 100) : 0;
                  return Number.isFinite(calc) ? calc : 0;
                });
                const soma = areas.reduce((acc: number, a: number) => acc + a, 0);
                return Math.min(talhaoArea, soma);
              })();

              // Produtos aplicados sobre a área efetivamente coberta
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
             // Fallback
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
                      epoca: "Plantio",
                      area_ha: areaCalculada > 0 ? areaCalculada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-",
                      propria: cultivar?.semente_propria ? "Sim" : "Não",
                      emb: cultivar?.unidade || (cultivar?.embalagem || "Bigbag"),
                      percent_plant: percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%",
                      tratamento: tratamento,
                      tipo_especifico: tipoEspecifico
                  };
              }),
              produtos: (() => {
                const areaTotal = Number(prog.area_hectares || 0);
                const areas = cultivares.map((c: any) => {
                  const perc = c?.percentual_cobertura ? Number(c.percentual_cobertura) : 100;
                  const calc = areaTotal > 0 ? (areaTotal * perc / 100) : 0;
                  return Number.isFinite(calc) ? calc : 0;
                });
                const areaCobertaProg = Math.min(areaTotal, areas.reduce((acc: number, a: number) => acc + a, 0));
                return products.map(p => ({
                  ...p,
                  total_kg: (parseFloat(p.quant_ha.replace(',', '.')) * areaCobertaProg).toLocaleString('pt-BR', { minimumFractionDigits: 3 }),
                  area_aplicada: areaCobertaProg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                }));
              })()
             }];
          }
        } catch (e) {
          console.error(e);
          return null;
        }
      });

      const nestedResults = await Promise.all(promises);
      nestedResults.forEach(r => {
        if (r) results.push(...r);
      });
      
      return results;
    }
  });

  // Fetch detailed data for the selected consultor
  const { data: detailedReportConsultorData = [], isLoading: loadingConsultorDetailed } = useQuery({
    queryKey: ["detailed-report-consultor", consultorFilter, safraFilter],
    enabled: !!consultorFilter,
    queryFn: async () => {
      // Find producers for this consultant
      const targetProdutores = produtores.filter(p => p.consultor === consultorFilter).map(p => p.numerocm);
      
      const filteredProgs = allProgramacoes.filter(p => {
        const matchProdutor = targetProdutores.includes(p.produtor_numerocm);
        const matchSafra = !safraFilter || String(p.safra_id || "") === safraFilter;
        return matchProdutor && matchSafra;
      });

      const results: DetailedReportItem[] = [];
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const baseUrl = getApiBaseUrl();

      // Pre-fetch all talhoes for the produtor's fazendas
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
          
          const produtor = produtores.find(p => p.numerocm === prog.produtor_numerocm);
          const fazenda = allFazendas.find(f => f.idfazenda === prog.fazenda_idfazenda && f.numerocm === prog.produtor_numerocm);
          
          const talhoesIds = (children.talhoes || []) as string[];
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
            return talhoesIds.map(tid => {
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
                      epoca: "Plantio",
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
                      epoca: "Plantio",
                      area_ha: areaCalculada > 0 ? areaCalculada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-",
                      propria: cultivar?.semente_propria ? "Sim" : "Não",
                      emb: cultivar?.unidade || (cultivar?.embalagem || "Bigbag"),
                      percent_plant: percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%",
                      tratamento: tratamento,
                      tipo_especifico: tipoEspecifico
                  };
              }),
              produtos: (() => {
                const areaTotal = Number(prog.area_hectares || 0);
                const areas = cultivares.map((c: any) => {
                  const perc = c?.percentual_cobertura ? Number(c.percentual_cobertura) : 100;
                  const calc = areaTotal > 0 ? (areaTotal * perc / 100) : 0;
                  return Number.isFinite(calc) ? calc : 0;
                });
                const areaCobertaProg = Math.min(areaTotal, areas.reduce((acc: number, a: number) => acc + a, 0));
                return products.map(p => ({
                  ...p,
                  total_kg: (parseFloat(p.quant_ha.replace(',', '.')) * areaCobertaProg).toLocaleString('pt-BR', { minimumFractionDigits: 3 }),
                  area_aplicada: areaCobertaProg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                }));
              })()
             }];
          }
        } catch (e) {
          console.error(e);
          return null;
        }
      });

      const nestedResults = await Promise.all(promises);
      nestedResults.forEach(r => {
        if (r) results.push(...r);
      });
      
      return results;
    }
  });

  const cultivaresList = cultivares ?? [];
  const adubacoesList = adubacoes ?? [];
  const defensivosList = defensivos ?? [];

  const resumo = useMemo(() => {
    const filterCult = (cultivaresList || []).filter((item) => {
      if (!safraFilter) return true;
      return String(item.safra || "").trim() === safraFilter;
    });
    const filterAdub = (adubacoesList || []).filter((item) => {
      if (!safraFilter) return true;
      return String(item.safra_id || "").trim() === safraFilter;
    });
    const filterDef = (defensivosList || []).map((ap) => ({
      ...ap,
      defensivos: (ap.defensivos || []).filter((d) => !safraFilter || String(d.safra_id || "").trim() === safraFilter),
    })).filter((ap) => ap.defensivos.length > 0 || !safraFilter);
    const totalQuantidade = cultivaresList.reduce(
      (acc, item) => acc + parseNumber(item.quantidade),
      0
    );

    const totalHectares = cultivaresList.reduce((acc, item) => {
      const areaValue = item.area;
      const match = typeof areaValue === "string" ? areaValue.match(/(\d+(\.\d+)?)/) : null;
      if (match) {
        return acc + parseFloat(match[1]);
      }
      return acc;
    }, 0);

    const totalAdubacao = filterAdub.reduce(
      (acc, item) => acc + parseNumber(item.total),
      0
    );

    const totalDefensivo = filterDef.reduce((acc, aplicacao) => {
      const somaAplicacao = (aplicacao.defensivos || []).reduce(
        (sum, def) => sum + parseNumber(def.dose),
        0
      );
      return acc + somaAplicacao;
    }, 0);

    const safras = new Set<string>();
    cultivaresList.forEach((item) => {
      const safra = String(item.safra ?? "").trim();
      if (safra) {
        safras.add(safra);
      }
    });

    return {
      cultivares: filterCult.length,
      quantidadeSementes: totalQuantidade,
      hectares: totalHectares,
      adubacoes: filterAdub.length,
      volumeAdubacao: totalAdubacao,
      defensivos: filterDef.length,
      volumeDefensivo: totalDefensivo,
      safras: Array.from(safras),
    };
  }, [cultivaresList, adubacoesList, defensivosList, safraFilter, safras]);

  const downloadCsv = (filename: string, headers: string[], rows: Array<Record<string, any>>) => {
    const escape = (v: any) => {
      const s = String(v ?? "");
      if (s.includes(";") || s.includes("\n") || s.includes("\"")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const csv = [headers.join(";")]
      .concat(rows.map((r) => headers.map((h) => escape(r[h])).join(";")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCultivaresCsv = () => {
    const headers = ["produtor_numerocm", "area", "area_hectares", "cultivar", "quantidade", "percentual_cobertura", "tipo_embalagem", "tipo_tratamento", "safra"];
    const rows = (cultivaresList || [])
      .filter((i) => !safraFilter || String(i.safra || "").trim() === safraFilter)
      .map((i: any) => ({
        produtor_numerocm: i.produtor_numerocm,
        area: i.area,
        area_hectares: i.area_hectares,
        cultivar: i.cultivar,
        quantidade: i.quantidade,
        percentual_cobertura: i.percentual_cobertura,
        tipo_embalagem: i.tipo_embalagem,
        tipo_tratamento: i.tipo_tratamento,
        safra: i.safra,
      }));
    downloadCsv(`cultivares_${safraFilter || 'todas'}.csv`, headers, rows);
  };

  const exportAdubacaoCsv = () => {
    const headers = ["produtor_numerocm", "area", "formulacao", "dose", "percentual_cobertura", "total", "safra_id"];
    const rows = (adubacoesList || [])
      .filter((i) => !safraFilter || String(i.safra_id || "").trim() === safraFilter)
      .map((i: any) => ({
        produtor_numerocm: i.produtor_numerocm,
        area: i.area,
        formulacao: i.formulacao,
        dose: i.dose,
        percentual_cobertura: i.percentual_cobertura,
        total: i.total,
        safra_id: i.safra_id,
      }));
    downloadCsv(`adubacao_${safraFilter || 'todas'}.csv`, headers, rows);
  };

  const exportDefensivosCsv = () => {
    const headers = ["produtor_numerocm", "area", "classe", "defensivo", "dose", "unidade", "alvo", "safra_id"];
    const rows = (defensivosList || []).flatMap((ap: any) =>
      (ap.defensivos || [])
        .filter((d: any) => !safraFilter || String(d.safra_id || "").trim() === safraFilter)
        .map((d: any) => ({
          produtor_numerocm: ap.produtor_numerocm,
          area: ap.area,
          classe: d.classe,
          defensivo: d.defensivo,
          dose: d.dose,
          unidade: d.unidade,
          alvo: d.alvo,
          safra_id: d.safra_id,
        }))
    );
    downloadCsv(`defensivos_${safraFilter || 'todas'}.csv`, headers, rows);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Relatorios</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Relatorios consolidados</h2>
            <p className="text-muted-foreground">Visualize dados consolidados filtrando por safra</p>
            <div className="mt-3 flex items-center gap-4">
              <div>
                <label className="text-sm mr-2">Safra</label>
                <select
                  className="border rounded h-8 px-2 text-sm"
                  value={safraFilter}
                  onChange={(e) => setSafraFilter(e.target.value)}
                >
                  <option value="">Todas</option>
                  {(safras || []).map((s: any) => (
                    <option key={s.id} value={String(s.id)}>{s.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <PDFDownloadLink
            document={
              <RelatorioPDF
                data={{
                  ...resumo,
                  safra: (safras || []).find((s: any) => String(s.id) === safraFilter)?.nome || ""
                }}
              />
            }
            fileName={`relatorio_${safraFilter ? safraFilter : 'geral'}.pdf`}
          >
            {({ loading }) => (
              <Button variant="default" disabled={loading}>
                <FileDown className="mr-2 h-4 w-4" />
                {loading ? 'Gerando PDF...' : 'Baixar PDF Consolidado'}
              </Button>
            )}
          </PDFDownloadLink>
        </div>

        <div className="mb-6 p-4 border rounded-lg bg-card">
          <h2 className="text-lg font-bold mb-4">Relatório Detalhado por Produtor</h2>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/3">
              <label className="text-sm block mb-1">Selecione o Produtor</label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {produtorFilter
                      ? produtores.find((p) => p.numerocm === produtorFilter)?.nome || produtorFilter
                      : "Selecione..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar produtor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum produtor encontrado.</CommandEmpty>
                      <CommandGroup>
                        {produtores.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.numerocm} - ${p.nome}`}
                            onSelect={() => {
                              setProdutorFilter(p.numerocm === produtorFilter ? "" : p.numerocm);
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                produtorFilter === p.numerocm ? "opacity-100" : "opacity-0"
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
            
            <div>
              {produtorFilter && !loadingDetailed && detailedReportData.length > 0 && (
                <PDFDownloadLink
                  document={
                    <RelatorioDetalhadoPDF
                      data={detailedReportData}
                      produtorFilter={produtores.find(p => p.numerocm === produtorFilter)?.nome || produtorFilter}
                      safraFilter={(safras || []).find((s: any) => String(s.id) === safraFilter)?.nome}
                    />
                  }
                  fileName={`relatorio_detalhado_${produtorFilter}.pdf`}
                >
                  {({ loading }) => (
                    <Button variant="default" disabled={loading || loadingDetailed}>
                      <FileDown className="mr-2 h-4 w-4" />
                      {loading ? 'Gerando PDF...' : 'Baixar Relatório Detalhado'}
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
              {produtorFilter && (loadingDetailed || detailedReportData.length === 0) && (
                 <Button variant="default" disabled>
                   <FileDown className="mr-2 h-4 w-4" />
                   {loadingDetailed ? 'Carregando dados...' : 'Sem dados para o filtro'}
                 </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 p-4 border rounded-lg bg-card">
          <h2 className="text-lg font-bold mb-4">Relatório Detalhado por Consultor</h2>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/3">
              <label className="text-sm block mb-1">Selecione o Consultor</label>
              <Popover open={openConsultorCombobox} onOpenChange={setOpenConsultorCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openConsultorCombobox}
                    className="w-full justify-between"
                  >
                    {consultorFilter
                      ? consultorFilter
                      : "Selecione..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0">
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
                              setConsultorFilter(c === consultorFilter ? "" : c);
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
            
            <div>
              {consultorFilter && !loadingConsultorDetailed && detailedReportConsultorData.length > 0 && (
                <PDFDownloadLink
                  document={
                    <RelatorioDetalhadoConsultorPDF
                      data={detailedReportConsultorData}
                      consultorFilter={consultorFilter}
                      safraFilter={(safras || []).find((s: any) => String(s.id) === safraFilter)?.nome}
                    />
                  }
                  fileName={`relatorio_consultor_${consultorFilter}.pdf`}
                >
                  {({ loading }) => (
                    <Button variant="default" disabled={loading || loadingConsultorDetailed}>
                      <FileDown className="mr-2 h-4 w-4" />
                      {loading ? 'Gerando PDF...' : 'Baixar Relatório por Consultor'}
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
              {consultorFilter && (loadingConsultorDetailed || detailedReportConsultorData.length === 0) && (
                 <Button variant="default" disabled>
                   <FileDown className="mr-2 h-4 w-4" />
                   {loadingConsultorDetailed ? 'Carregando dados...' : 'Sem dados para o filtro'}
                 </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Resumo de cultivares</h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cultivares</span>
                <span className="font-semibold">{resumo.cultivares}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Quantidade total</span>
                <span className="font-semibold">{resumo.quantidadeSementes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Hectares identificados</span>
                <span className="font-semibold">{resumo.hectares.toFixed(2)} ha</span>
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={exportCultivaresCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Resumo de adubacoes</h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Programacoes</span>
                <span className="font-semibold">{resumo.adubacoes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Volume total</span>
                <span className="font-semibold">{resumo.volumeAdubacao.toFixed(2)}</span>
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={exportAdubacaoCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Resumo de defensivos</h3>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Aplicacoes</span>
                <span className="font-semibold">{resumo.defensivos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Volume total</span>
                <span className="font-semibold">{resumo.volumeDefensivo.toFixed(2)}</span>
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={exportDefensivosCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Safras monitoradas</h3>
            <div className="space-y-3 mb-4">
              {resumo.safras.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma safra identificada nas consultas.</p>
              ) : (
                resumo.safras.map((safra) => (
                  <div key={safra} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{safra}</span>
                    <span className="font-semibold">
                      {
                        cultivaresList.filter(
                          (item) => String(item.safra ?? "") === safra
                        ).length
                      }
                    </span>
                  </div>
                ))
              )}
            </div>
            <Button className="w-full" variant="outline" onClick={() => exportCultivaresCsv()}>
              <Download className="mr-2 h-4 w-4" />
              Exportar resumo
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Relatorios;
