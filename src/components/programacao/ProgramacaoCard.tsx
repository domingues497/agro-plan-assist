import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  ChevronDown, 
  Pencil, 
  Copy, 
  Trash2, 
  Settings,
  Loader2
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface ProgramacaoCardProps {
  prog: any;
  produtor: any;
  fazenda: any;
  isAdmin: boolean;
  isConsultor: boolean;
  canEdit: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  isLoadingEdit: string | null;
  talhoesCount: number;
  areaProgramada: number;
  areaTotal: number;
  onEdit: () => void;
  onReplicate: () => void;
  onDelete: () => void;
  onUpdateRevisada: (checked: boolean) => void;
  onGerenciarTalhoes: () => void;
}

export function ProgramacaoCard({
  prog,
  produtor,
  fazenda,
  isAdmin,
  isConsultor,
  canEdit,
  canDuplicate,
  canDelete,
  isLoadingEdit,
  talhoesCount,
  areaProgramada,
  areaTotal,
  onEdit,
  onReplicate,
  onDelete,
  onUpdateRevisada,
  onGerenciarTalhoes
}: ProgramacaoCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const toggleDetails = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState && !details) {
      setIsLoadingDetails(true);
      try {
        const { getApiBaseUrl } = await import("@/lib/utils");
        const baseUrl = getApiBaseUrl();
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("auth_token")}`
        };
        const res = await fetch(`${baseUrl}/programacoes/${prog.id}/children`, { headers });
        if (res.ok) {
          const data = await res.json();
          setDetails(data);
        }
      } catch (error) {
        console.error("Erro ao carregar detalhes", error);
      } finally {
        setIsLoadingDetails(false);
      }
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow overflow-hidden">
      <div className="flex items-center justify-between p-6 pb-4">
        <div className="flex items-center gap-3 flex-1">
          <Calendar className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg truncate">
                {prog.produtor_numerocm}
                {produtor?.cod_empresa ? ` / ${produtor.cod_empresa}` : ""} - {produtor?.nome || ""}
              </h3>
              {prog.tipo === 'PREVIA' && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200">
                  Prévia
                </Badge>
              )}
              {talhoesCount === 0 && (
                <Badge variant="destructive" className="text-xs">
                  Programação Replicada Favor Informar Talhão
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
              <span className="font-medium">Safra:</span>
              <span>{prog.safra_nome || "—"}</span>
              <span className="text-muted-foreground/30">|</span>
              <span className="font-medium">Fazenda:</span>
              <span>
                {fazenda?.nomefazenda || "—"}
                {areaTotal > 0 ? ` (${areaTotal.toFixed(2)} ha)` : ""}
              </span>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onGerenciarTalhoes();
                }}
                title="Gerenciar talhões"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
            <div className="flex items-center gap-2 mr-2" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                id={`revisada-${prog.id}`}
                checked={!!prog.revisada}
                onCheckedChange={onUpdateRevisada}
              />
              <label
                htmlFor={`revisada-${prog.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer hidden sm:block"
              >
                Revisada
              </label>
            </div>
          
          <Button
            variant="outline"
            size="icon"
            disabled={isLoadingEdit === prog.id || !canEdit}
            onClick={onEdit}
            title="Editar"
          >
            {isLoadingEdit === prog.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            disabled={!canDuplicate}
            onClick={onReplicate}
            title="Replicar"
          >
            <Copy className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            disabled={!canDelete}
            onClick={onDelete}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      <Button
        variant="ghost"
        className="w-full flex items-center justify-between px-6 py-4 h-auto hover:bg-accent/50 rounded-none"
        onClick={toggleDetails}
      >
        <span className="text-sm font-medium">
          Detalhes.
        </span>
        <ChevronDown 
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </Button>

      {isOpen && (
        <div className="px-6 pb-6 pt-2 bg-accent/10 border-t space-y-6 animate-in slide-in-from-top-2 duration-200">
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando detalhes...
            </div>
          ) : details ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Coluna 1: Talhões */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Talhões ({details.talhoes?.length || 0})
                </h4>
                {details.talhoes && details.talhoes.length > 0 ? (
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {details.talhoes.map((t: any) => (
                      <li key={t.id} className="flex justify-between border-b border-border/50 pb-1 last:border-0">
                        <span>{t.nome}</span>
                        <span className="text-xs font-mono bg-background px-1 rounded border">
                          {Number(t.area || 0).toFixed(2)} ha
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhum talhão vinculado.</p>
                )}
              </div>

              {/* Coluna 2: Cultivares */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Cultivares ({details.cultivares?.length || 0})
                </h4>
                {details.cultivares && details.cultivares.length > 0 ? (
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {details.cultivares.map((c: any, idx: number) => (
                      <li key={idx} className="flex flex-col border-b border-border/50 pb-1 last:border-0">
                        <div className="flex justify-between">
                          <span className="font-medium">{c.cultivar}</span>
                          <span className="text-xs font-mono bg-background px-1 rounded border">
                            {c.percentual_cobertura}%
                          </span>
                        </div>
                        {c.cultura && <span className="text-xs opacity-80">{c.cultura}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhum cultivar.</p>
                )}
              </div>

              {/* Coluna 3: Fertilizantes */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  Fertilizantes ({details.adubacao?.length || 0})
                </h4>
                {details.adubacao && details.adubacao.length > 0 ? (
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {details.adubacao.map((a: any, idx: number) => (
                      <li key={idx} className="flex flex-col border-b border-border/50 pb-1 last:border-0">
                        <div className="flex justify-between">
                          <span className="font-medium">{a.formulacao}</span>
                          <span className="text-xs font-mono bg-background px-1 rounded border">
                            {a.dose} Kg/ha
                          </span>
                        </div>
                        {a.embalagem && <span className="text-xs opacity-80">{a.embalagem}</span>}
                        {a.justificativa_descricao && (
                          <span className="text-xs text-orange-600 mt-0.5 italic">
                            {a.justificativa_descricao}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma adubação.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">Erro ao carregar detalhes.</p>
          )}
        </div>
      )}
    </Card>
  );
}
