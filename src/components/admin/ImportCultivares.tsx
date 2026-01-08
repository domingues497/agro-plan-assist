import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useProfile } from "@/hooks/useProfile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCultivaresCounts, useImportCultivaresMutation, useCreateCultivarMutation } from "@/hooks/useImportCultivares";

export const ImportCultivares = () => {
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [limparAntes, setLimparAntes] = useState(false);
  const [deletedRows, setDeletedRows] = useState(0);
  const [skippedRows, setSkippedRows] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const { data: adminRole } = useAdminRole();
  const { profile } = useProfile();
  const [openNew, setOpenNew] = useState(false);
  const [newCultivar, setNewCultivar] = useState("");
  const [newCultura, setNewCultura] = useState("");
  const [newNomeCientifico, setNewNomeCientifico] = useState("");

  const { data: counts = { catalogTotal: 0, cultureCounts: {}, catalogSemCultura: 0 } } = useCultivaresCounts();
  const { catalogTotal, cultureCounts, catalogSemCultura } = counts;

  const importMutation = useImportCultivaresMutation();
  const createMutation = useCreateCultivarMutation();

  const isImporting = importMutation.isPending;
  const savingNew = createMutation.isPending;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    setImportedRows(0);
    setDeletedRows(0);
    setSkippedRows(0);
    setShowSummary(false);

    try {
      const isAdmin = !!adminRole?.isAdmin;
      if (!isAdmin) {
        toast.error("Apenas administradores podem importar cultivares. Solicite acesso ao perfil admin.");
        return;
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      console.log("Total de linhas no Excel:", jsonData.length);
      console.log("Primeira linha:", jsonData[0]);
      console.log("Colunas detectadas:", jsonData[0] ? Object.keys(jsonData[0]) : []);
      
      setTotalRows(jsonData.length);

      // Processar e normalizar dados
      // Importante: deduplicar por par (cultivar, cultura) para não perder associações
      const processedData = new Map<string, any>();
      let skippedEmpty = 0;
      let skippedDuplicate = 0;
      
      for (const row of jsonData as any[]) {
        // Tentar múltiplas variações do nome da coluna
        const cultivar = (
          row["CULTIVAR"] || 
          row["Cultivar"] || 
          row["cultivar"] || 
          row["CULTIVAR "] || // com espaço no final
          row[" CULTIVAR"] || // com espaço no início
          ""
        )?.toString().toUpperCase().trim() || null;
        
        if (!cultivar) {
          skippedEmpty++;
          console.log("Linha sem cultivar ignorada:", row);
          continue;
        }
        
        
        // Normalizar cultura (aceitar qualquer cultura, apenas normalizar o texto)
        const culturaRaw = (
          row["CULTURA"] || 
          row["Cultura"] || 
          row["cultura"] ||
          row["CULTURA "] ||
          row[" CULTURA"] ||
          ""
        )?.toString().toUpperCase().trim();

        let cultura: string | null = null;
        if (culturaRaw) {
          // Remover espaços extras e normalizar
          cultura = culturaRaw.replace(/\s+/g, " ").trim();
          
          // Normalizar variações conhecidas para nomes padrão
          if (["ZEA MAYS", "MILHO HÍBRIDO", "MILHO HIDRIDO"].includes(cultura)) {
            cultura = "MILHO";
          } else if (["GLYCINE MAX", "SOJA RR", "SOJA CONVENCIONAL"].includes(cultura)) {
            cultura = "SOJA";
          } else if (["AVEIA BRANCA", "AVEIA PRETA"].includes(cultura)) {
            cultura = "AVEIA";
          }
          // Outras culturas mantêm o nome original normalizado
        }

        const nomeCientifico = (
          row["NOME_CIENTIFICO"] || 
          row["Nome_Cientifico"] || 
          row["nome_cientifico"] ||
          row["NOME CIENTIFICO"] ||
          row["NOME_CIENTIFICO "] ||
          row[" NOME_CIENTIFICO"] ||
          ""
        )?.toString().trim() || null;
        
        const cultivarData = {
          cultivar: cultivar,
          cultura: cultura,
          nome_cientifico: nomeCientifico,
        };
        
        // Usar chave composta para evitar colapsar cultivares iguais de culturas diferentes
        const compositeKey = `${cultivar}||${cultura ?? ""}`;
        if (processedData.has(compositeKey)) {
          skippedDuplicate++;
          console.log("Par cultivar+cultura duplicado ignorado:", compositeKey);
          continue;
        }
        processedData.set(compositeKey, cultivarData);
      }

      console.log(`Processamento: ${jsonData.length} linhas lidas, ${processedData.size} válidas, ${skippedEmpty} vazias, ${skippedDuplicate} duplicadas`);
      setSkippedRows(skippedEmpty + skippedDuplicate);

      // Importar dados únicos
      const dataArray = Array.from(processedData.values());
      setErrorMessages([]);
      
      importMutation.mutate(
        { items: dataArray, limparAntes, userId: profile?.id, fileName: file.name },
        {
          onSuccess: (json) => {
            const imported = Number(json?.imported || dataArray.length);
            const deletedRecords = Number(json?.deleted || 0);
            setImportedRows(imported);
            setDeletedRows(deletedRecords);

            const skippedCount = jsonData.length - dataArray.length;
            
            if (imported > 0) {
              toast.success(`Importação concluída! ${imported} registros processados${skippedCount > 0 ? ` (${skippedCount} linhas ignoradas)` : ''}`);
            } else {
              const detail = errorMessages.length > 0 ? `\nDetalhes: ${errorMessages.join(" | ")}` : "";
              toast.error(`Nenhum registro foi importado.${detail}`);
            }
            setShowSummary(true);
            setFile(null);
            setLimparAntes(false);
          },
          onError: (err) => {
             console.error("Erro ao processar arquivo:", err);
             toast.error(`Erro ao processar arquivo: ${err.message}`);
             if (err.message) {
                 setErrorMessages([err.message]);
             }
          }
        }
      );

    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error(`Erro ao processar arquivo: ${(error as any)?.message || error}`);
    }
  };

  const handleCreateNew = async () => {
    const cultivar = newCultivar.trim();
    const cultura = newCultura.trim();
    const nome_cientifico = newNomeCientifico.trim();
    if (!cultivar) {
      toast.error("Informe o nome da cultivar");
      return;
    }
    const isAdmin = !!adminRole?.isAdmin;
    if (!isAdmin) {
      toast.error("Apenas administradores podem cadastrar cultivares.");
      return;
    }

    const item = {
        cultivar: cultivar.toUpperCase(),
        cultura: cultura ? cultura.toUpperCase() : null,
        nome_cientifico: nome_cientifico || null,
    };

    createMutation.mutate(
        { item, userId: profile?.id },
        {
            onSuccess: () => {
                toast.success("Cultivar cadastrada com sucesso");
                setOpenNew(false);
                setNewCultivar("");
                setNewCultura("");
                setNewNomeCientifico("");
            },
            onError: (e) => {
                toast.error(e.message || String(e));
            }
        }
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Importar Cultivares</CardTitle>
          <Button onClick={() => setOpenNew(true)}>
            Nova Cultivar
          </Button>
        </div>
        <CardDescription>
          Faça upload de uma planilha Excel (.xlsx ou .xls) com as colunas: CULTIVAR, CULTURA, NOME_CIENTIFICO (opcional)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cultivares-file">Selecione o arquivo</Label>
          <div className="flex items-center gap-4">
            <Input
              id="cultivares-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isImporting}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="limpar-antes"
            checked={limparAntes}
            onCheckedChange={(checked) => setLimparAntes(checked as boolean)}
            disabled={isImporting}
          />
          <Label htmlFor="limpar-antes" className="cursor-pointer text-sm">
            Limpar todos os registros antes de importar
          </Label>
        </div>

        <Button onClick={handleImport} disabled={isImporting || !file}>
          {isImporting ? "Importando..." : "Importar"}
        </Button>
        {/* Resumo abaixo da importação: total e todas as culturas */}
        <div className="space-y-2">
          <div className="flex justify-between items-center p-2 bg-muted rounded">
            <span className="text-sm font-medium">Total no catálogo:</span>
            <Badge variant="outline">{catalogTotal}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(cultureCounts).map(([cultura, count]) => (
              <div key={cultura} className="flex justify-between items-center p-2 bg-primary/10 rounded">
                <span className="text-sm font-medium">{cultura}:</span>
                <Badge variant="default">{count}</Badge>
              </div>
            ))}
            <div className="flex justify-between items-center p-2 bg-warning/10 rounded">
              <span className="text-sm font-medium">Sem cultura:</span>
              <Badge variant="outline">{catalogSemCultura}</Badge>
            </div>
          </div>
        </div>
        {isImporting && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-medium">
                Importando arquivo...
              </p>
            </div>
            {totalRows > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  {importedRows} de {totalRows} linhas processadas
                </p>
                <Progress value={Math.round((importedRows / totalRows) * 100)} />
              </>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar nova cultivar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Cultivar *</Label>
              <Input value={newCultivar} onChange={(e) => setNewCultivar(e.target.value)} placeholder="Ex: 5950 PRO"
              />
            </div>
            <div className="space-y-2">
              <Label>Cultura</Label>
              <Input value={newCultura} onChange={(e) => setNewCultura(e.target.value)} placeholder="Ex: MILHO"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome científico (opcional)</Label>
              <Input value={newNomeCientifico} onChange={(e) => setNewNomeCientifico(e.target.value)} placeholder="Ex: Zea mays"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpenNew(false)} disabled={savingNew}>Cancelar</Button>
              <Button onClick={handleCreateNew} disabled={savingNew}>{savingNew ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              Importação Concluída
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <div className="grid gap-2">
                  {deletedRows > 0 && (
                    <div className="flex justify-between items-center p-2 bg-destructive/10 rounded">
                      <span className="text-sm font-medium">Registros removidos:</span>
                      <Badge variant="destructive">{deletedRows}</Badge>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm font-medium">Total processado:</span>
                    <Badge variant="outline">{totalRows}</Badge>
                  </div>
                  {skippedRows > 0 && (
                    <div className="flex justify-between items-center p-2 bg-warning/10 rounded">
                      <span className="text-sm font-medium">Linhas ignoradas:</span>
                      <Badge variant="outline">{skippedRows}</Badge>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-2 bg-primary/10 rounded">
                    <span className="text-sm font-medium">Registros importados:</span>
                    <Badge variant="default">{importedRows}</Badge>
                  </div>
                  {errorMessages.length > 0 && (
                    <div className="p-2 bg-destructive/10 rounded">
                      <span className="text-sm font-medium">Erros:</span>
                      <div className="text-xs text-destructive-foreground break-words">
                        {errorMessages.map((msg, i) => (
                          <div key={i}>• {msg}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  A importação foi registrada no histórico de importações.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
