import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

export const ImportCultivares = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [limparAntes, setLimparAntes] = useState(false);
  const [deletedRows, setDeletedRows] = useState(0);
  const [skippedRows, setSkippedRows] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [catalogTotal, setCatalogTotal] = useState<number>(0);
  const [catalogMilho, setCatalogMilho] = useState<number>(0);
  const [catalogSoja, setCatalogSoja] = useState<number>(0);
  const [catalogSemCultura, setCatalogSemCultura] = useState<number>(0);

  const fetchCounts = async () => {
    try {
      const total = await supabase
        .from("cultivares_catalog")
        .select("*", { count: "exact", head: true });
      const milho = await supabase
        .from("cultivares_catalog")
        .select("*", { count: "exact", head: true })
        .eq("cultura", "MILHO");
      const soja = await supabase
        .from("cultivares_catalog")
        .select("*", { count: "exact", head: true })
        .eq("cultura", "SOJA");
      const sem = await supabase
        .from("cultivares_catalog")
        .select("*", { count: "exact", head: true })
        .is("cultura", null);

      setCatalogTotal(total.count || 0);
      setCatalogMilho(milho.count || 0);
      setCatalogSoja(soja.count || 0);
      setCatalogSemCultura(sem.count || 0);
    } catch (e) {
      console.error("Erro ao carregar contagens de cultivares:", e);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

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

    setIsImporting(true);
    setImportedRows(0);
    setDeletedRows(0);
    setSkippedRows(0);
    setShowSummary(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let deletedRecords = 0;

      // Limpar tabela se checkbox marcado
      if (limparAntes) {
        const { count } = await supabase
          .from("cultivares_catalog")
          .select("*", { count: "exact", head: true });
        
        deletedRecords = count || 0;

        const { error: deleteError } = await supabase
          .from("cultivares_catalog")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        
        if (deleteError) {
          console.error("Erro ao limpar tabela:", deleteError);
          toast.error("Erro ao limpar tabela");
          setIsImporting(false);
          return;
        }
        setDeletedRows(deletedRecords);
        toast.info(`${deletedRecords} registros removidos`);
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
        
        // Se já existe um cultivar com o mesmo nome, pular
        if (processedData.has(cultivar)) {
          skippedDuplicate++;
          console.log("Cultivar duplicado ignorado:", cultivar);
          continue;
        }
        
        // Normalizar cultura para obedecer à constraint do banco (MILHO/SOJA)
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
          const c = culturaRaw.replace(/\s+/g, " ").trim();
          if (["MILHO", "ZEA MAYS", "MILHO HÍBRIDO", "MILHO HIDRIDO"].includes(c)) {
            cultura = "MILHO";
          } else if (["SOJA", "GLYCINE MAX", "SOJA RR", "SOJA CONVENCIONAL"].includes(c)) {
            cultura = "SOJA";
          } else {
            // Valores não suportados pela constraint: deixar nulo para não violar CHECK
            cultura = null;
          }
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
        
        processedData.set(cultivar, cultivarData);
      }

      console.log(`Processamento: ${jsonData.length} linhas lidas, ${processedData.size} válidas, ${skippedEmpty} vazias, ${skippedDuplicate} duplicadas`);
      setSkippedRows(skippedEmpty + skippedDuplicate);

      // Importar dados únicos em lotes de 500
      const batchSize = 500;
      const dataArray = Array.from(processedData.values());
      let imported = 0;
      let failedBatches = 0;
      
      for (let i = 0; i < dataArray.length; i += batchSize) {
        const batch = dataArray.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from("cultivares_catalog")
          .upsert(batch, { 
            onConflict: "cultivar",
            ignoreDuplicates: false 
          });

        if (error) {
          console.error("Erro ao importar lote:", error);
          failedBatches++;
        } else {
          imported += batch.length;
          setImportedRows(imported);
        }
      }

      // Registrar no histórico
      await supabase.from("import_history").insert({
        user_id: user.id,
        tabela_nome: "cultivares_catalog",
        registros_importados: imported,
        registros_deletados: deletedRecords,
        arquivo_nome: file.name,
        limpar_antes: limparAntes,
      });

      const skippedCount = totalRows - dataArray.length;
      console.log(`Importação concluída: ${imported} importados, ${skippedCount} ignorados, ${failedBatches} lotes com erro`);
      
      if (imported > 0) {
        toast.success(`Importação concluída! ${imported} registros únicos importados${skippedCount > 0 ? ` (${skippedCount} linhas ignoradas)` : ''}${failedBatches > 0 ? `, ${failedBatches} lotes com erro` : ''}`);
      } else {
        toast.error(`Nenhum registro foi importado. Verifique o formato do arquivo e as colunas: CULTIVAR, CULTURA, NOME_CIENTIFICO`);
      }
      setShowSummary(true);
      setFile(null);
      setLimparAntes(false);
      // Atualizar contagens após importação
      await fetchCounts();
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo. Verifique o formato.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Cultivares</CardTitle>
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
        {/* Resumo abaixo da importação: total e por cultura */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="flex justify-between items-center p-2 bg-muted rounded">
            <span className="text-sm font-medium">Total no catálogo:</span>
            <Badge variant="outline">{catalogTotal}</Badge>
          </div>
          <div className="flex justify-between items-center p-2 bg-primary/10 rounded">
            <span className="text-sm font-medium">Milho:</span>
            <Badge variant="default">{catalogMilho}</Badge>
          </div>
          <div className="flex justify-between items-center p-2 bg-primary/10 rounded">
            <span className="text-sm font-medium">Soja:</span>
            <Badge variant="default">{catalogSoja}</Badge>
          </div>
          <div className="flex justify-between items-center p-2 bg-warning/10 rounded">
            <span className="text-sm font-medium">Sem cultura:</span>
            <Badge variant="outline">{catalogSemCultura}</Badge>
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
