import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft, Download, FileDown, Check, ChevronsUpDown } from "lucide-react";
import { useProgramacaoCultivares } from "@/hooks/useProgramacaoCultivares";
import { useProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { useAplicacoesDefensivos } from "@/hooks/useAplicacoesDefensivos";
import { useSafras } from "@/hooks/useSafras";
import { useEpocas } from "@/hooks/useEpocas";
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
import { RelatorioResumoConsultorProdutorPDF } from "@/components/relatorios/RelatorioResumoConsultorProdutorPDF";
import { RelatorioProdutores } from "@/components/relatorios/RelatorioProdutores";
import { RelatorioProgramacaoSafra } from "@/components/relatorios/RelatorioProgramacaoSafra";
import { GlobalLoading } from "@/components/ui/global-loading";
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

import { useAdminRole } from "@/hooks/useAdminRole";

const Relatorios = () => {
  const { data: adminRole, isLoading: adminRoleLoading } = useAdminRole();
  const isAdmin = !!adminRole?.isAdmin;
  const { programacoes: cultProgramacoes = [], isLoading: cultLoading } = useProgramacaoCultivares();
  const { programacoes: adubacoes = [], isLoading: adubLoading } = useProgramacaoAdubacao();
  const { aplicacoes: defensivos = [], isLoading: defensivosLoading } = useAplicacoesDefensivos();
  const { safras = [], isLoading: safrasLoading } = useSafras() as any;
  const { data: produtores = [], isLoading: produtoresLoading } = useProdutores();
  const { programacoes: allProgramacoes = [], isLoading: programacoesLoading } = useProgramacoes();
  const { data: allFazendas = [], isLoading: fazendasLoading } = useFazendas();
  const { data: epocas = [], isLoading: epocasLoading } = useEpocas();
  const isPageLoading =
    (adminRoleLoading && !adminRole) ||
    (cultLoading && cultProgramacoes.length === 0) ||
    (adubLoading && adubacoes.length === 0) ||
    (defensivosLoading && defensivos.length === 0) ||
    (safrasLoading && safras.length === 0) ||
    (produtoresLoading && produtores.length === 0) ||
    (programacoesLoading && allProgramacoes.length === 0) ||
    (fazendasLoading && allFazendas.length === 0) ||
    (epocasLoading && epocas.length === 0);
  const [safraFilter, setSafraFilter] = useState<string>("");
  const [culturaFilter, setCulturaFilter] = useState<string>("");
  const [produtorFilter, setProdutorFilter] = useState<string>("");
  const [openCombobox, setOpenCombobox] = useState(false);
  const [consultorFilter, setConsultorFilter] = useState<string>("");
  const [openConsultorCombobox, setOpenConsultorCombobox] = useState(false);
  const [viewMode, setViewMode] = useState<"default" | "programacao_safra">("default");

  const consultores = useMemo(() => {
    const list = new Set<string>();
    produtores.forEach(p => {
      if (p.consultor) list.add(p.consultor);
    });
    return Array.from(list).sort();
  }, [produtores]);

  const culturasDisponiveis = useMemo(() => {
    const list = new Set<string>();
    cultProgramacoes.forEach(c => {
        if (c.cultura) list.add(c.cultura);
    });
    return Array.from(list).sort();
  }, [cultProgramacoes]);

  // Fetch detailed data for the selected produtor
  const { data: detailedReportData = [], isLoading: loadingDetailed } = useQuery({
    queryKey: ["detailed-report", produtorFilter, safraFilter, epocas],
    enabled: !!produtorFilter,
    queryFn: async () => {
      const filteredProgs = allProgramacoes.filter(p => {
        const matchProdutor = p.produtor_numerocm === produtorFilter;
        const matchSafra = !safraFilter || String(p.safra_id || "") === safraFilter;
        return matchProdutor && matchSafra;
      });

      const results: DetailedReportItem[] = [];
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
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
          const talhoesIds = (children.talhoes || []).map((t: any) => typeof t === 'object' ? t.id : t);
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
                      epoca: epocas.find((e: any) => String(e.id) === String(cultivar?.epoca_id))?.nome || "Plantio",
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
                      epoca: epocas.find((e: any) => String(e.id) === String(cultivar?.epoca_id))?.nome || "Plantio",
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
    queryKey: ["detailed-report-consultor", consultorFilter, safraFilter, epocas],
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
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
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

  const cultivaresList = cultProgramacoes ?? [];
  const adubacoesList = adubacoes ?? [];
  const defensivosList = defensivos ?? [];

  // Query Consolidados Backend
  const { data: consolidatedData, isLoading: loadingConsolidated } = useQuery({
    queryKey: ["reports-consolidated", safraFilter, culturaFilter],
    queryFn: async () => {
        const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const params = new URLSearchParams();
        if (safraFilter) params.append("safra_id", safraFilter);
        if (culturaFilter) params.append("cultura", culturaFilter);
        
        const res = await fetch(`${getApiBaseUrl()}/reports/consolidated?${params.toString()}`, { headers });
        if (!res.ok) throw new Error("Erro ao buscar consolidados");
        return res.json();
    }
  });

  // Query Resumo Consultor Backend
  const { data: summaryConsultorData = [], isLoading: loadingSummaryConsultor } = useQuery({
    queryKey: ["reports-summary-consultor", safraFilter, culturaFilter],
    queryFn: async () => {
        if (!safraFilter) return [];
        const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const params = new URLSearchParams();
        params.append("safra_id", safraFilter);
        if (culturaFilter) params.append("cultura", culturaFilter);
        
        const res = await fetch(`${getApiBaseUrl()}/reports/consultor_produtor_summary?${params.toString()}`, { headers });
        if (!res.ok) throw new Error("Erro ao buscar resumo consultor");
        return res.json();
    },
    enabled: !!safraFilter
  });

  const resumo = useMemo(() => {
    if (!consolidatedData) return {
        cultivares: 0,
        quantidadeSementes: 0,
        hectares: 0,
        adubacoes: 0,
        volumeAdubacao: 0,
        defensivos: 0,
        volumeDefensivo: 0,
        safras: []
    };

    return {
      cultivares: consolidatedData.cultivares_count,
      quantidadeSementes: consolidatedData.sementes_total,
      hectares: consolidatedData.area_total_ha,
      adubacoes: consolidatedData.adubacoes_count,
      volumeAdubacao: consolidatedData.adubo_total_kg,
      defensivos: consolidatedData.defensivos_count,
      volumeDefensivo: 0, // Backend retorna count, volume não calculado
      safras: safraFilter ? [(safras || []).find((s: any) => String(s.id) === safraFilter)?.nome || safraFilter] : [],
    };
  }, [consolidatedData, safraFilter, safras]);

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

  if (viewMode === "programacao_safra") {
    return (
      <div className="min-h-screen bg-background">
      <GlobalLoading isVisible={isPageLoading} message="Carregando relatórios..." />
      <header className="border-b bg-card print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-xl font-bold">Relatório de Programação de Safra</h1>
              <div className="ml-auto">
                 <Button variant="outline" onClick={() => setViewMode("default")}>
                   Voltar para Relatório Geral
                 </Button>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <RelatorioProgramacaoSafra />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GlobalLoading isVisible={isPageLoading} message="Carregando relatórios..." />
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
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
            <Button variant="outline" onClick={() => setViewMode("programacao_safra")}>
              Novo Relatório (Safra/Fazenda/Época)
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Atalho rápido para o novo relatório */}
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow border-primary/20 bg-primary/5" onClick={() => setViewMode("programacao_safra")}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Programação de Safra</h3>
                <p className="text-sm text-muted-foreground">Gerar relatório filtrado por Safra, Produtor, Fazenda e Época</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Filtros Gerais</CardTitle>
              <CardDescription>Selecione safra e cultura para filtrar os relatórios consolidados e resumos.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-1/3">
                <label className="text-sm font-medium mb-1 block">Safra</label>
                <select
                  className="w-full border rounded h-10 px-3 text-sm bg-background"
                  value={safraFilter}
                  onChange={(e) => setSafraFilter(e.target.value)}
                >
                  <option value="">Selecione uma safra...</option>
                  {(safras || []).map((s: any) => (
                    <option key={s.id} value={String(s.id)}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-1/3">
                <label className="text-sm font-medium mb-1 block">Cultura</label>
                <select
                  className="w-full border rounded h-10 px-3 text-sm bg-background"
                  value={culturaFilter}
                  onChange={(e) => setCulturaFilter(e.target.value)}
                >
                  <option value="">Todas</option>
                  {culturasDisponiveis.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Card Relatórios Consolidados */}
          <Card>
            <CardHeader>
              <CardTitle>Consolidado da Safra</CardTitle>
              <CardDescription>Totais de área, sementes e insumos.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingConsolidated ? (
                <div className="flex items-center justify-center py-4">
                   <GlobalLoading isVisible={true} message="" /> Carregando...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/20 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground">Área Total</p>
                      <p className="text-lg font-bold">{resumo.hectares.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ha</p>
                    </div>
                    <div className="bg-secondary/20 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground">Sementes</p>
                      <p className="text-lg font-bold">{resumo.quantidadeSementes.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                    </div>
                    <div className="bg-secondary/20 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground">Adubo Total</p>
                      <p className="text-lg font-bold">{resumo.volumeAdubacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</p>
                    </div>
                    <div className="bg-secondary/20 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground">Defensivos (Doses)</p>
                      <p className="text-lg font-bold">{resumo.defensivos.toLocaleString('pt-BR')}</p>
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
                    fileName={`relatorio_consolidado_${safraFilter || 'geral'}.pdf`}
                  >
                    {({ loading }) => (
                      <Button className="w-full" disabled={loading || loadingConsolidated}>
                        <FileDown className="mr-2 h-4 w-4" />
                        {loading ? 'Gerando PDF...' : 'Baixar PDF Consolidado'}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Resumo Consultor/Produtor */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo Consultor/Produtor</CardTitle>
              <CardDescription>Áreas físicas e programadas por consultor.</CardDescription>
            </CardHeader>
            <CardContent>
              {!safraFilter ? (
                 <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                   <p>Selecione uma safra para visualizar este relatório.</p>
                 </div>
              ) : loadingSummaryConsultor ? (
                 <div className="flex items-center justify-center py-8">Carregando dados...</div>
              ) : (
                <div className="space-y-4">
                   <div className="max-h-[200px] overflow-y-auto border rounded-md text-sm">
                      <table className="w-full">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Consultor</th>
                            <th className="p-2 text-left">Produtor</th>
                            <th className="p-2 text-right">Área (ha)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryConsultorData.slice(0, 10).map((item: any, idx: number) => (
                             <tr key={idx} className="border-t">
                               <td className="p-2">{item.consultor}</td>
                               <td className="p-2">{item.produtor}</td>
                               <td className="p-2 text-right">{item.area_fisica.toFixed(1)}</td>
                             </tr>
                          ))}
                          {summaryConsultorData.length > 10 && (
                            <tr><td colSpan={3} className="p-2 text-center text-muted-foreground">...e mais {summaryConsultorData.length - 10} registros</td></tr>
                          )}
                        </tbody>
                      </table>
                   </div>

                   <PDFDownloadLink
                      document={
                        <RelatorioResumoConsultorProdutorPDF
                          data={summaryConsultorData}
                          safra={(safras || []).find((s: any) => String(s.id) === safraFilter)?.nome || ""}
                          cultura={culturaFilter}
                        />
                      }
                      fileName={`resumo_consultor_produtor_${safraFilter}.pdf`}
                    >
                      {({ loading }) => (
                        <Button className="w-full" disabled={loading}>
                          <FileDown className="mr-2 h-4 w-4" />
                          {loading ? 'Gerando PDF...' : 'Baixar Resumo Consultor/Produtor'}
                        </Button>
                      )}
                    </PDFDownloadLink>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <RelatorioProdutores produtores={produtores} />

        <div className="grid grid-cols-1 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Relatório Detalhado por Produtor</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {isAdmin && (
          <Card>
            <CardHeader>
               <CardTitle>Relatório Detalhado por Consultor</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
          )}
        </div>


      </main>
    </div>
  );
};

export default Relatorios;
