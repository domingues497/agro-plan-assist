import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CalendarioRow = {
  cod_aplic: string;
  descr_aplicacao: string;
  cod_aplic_ger: string | null;
  cod_classe: string;
  descricao_classe: string;
  trat_sementes: string | null;
};

export const ImportCalendarioAplicacoes = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Por favor, selecione um arquivo");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const rows: CalendarioRow[] = jsonData
        .map((row: any) => ({
          cod_aplic: String(row["Cód. aplic."] || row["cod_aplic"] || "").trim(),
          descr_aplicacao: String(row["Descr. aplicação"] || row["descr_aplicacao"] || "").trim(),
          cod_aplic_ger: row["Cód. aplic. ger."] || row["cod_aplic_ger"] || null,
          cod_classe: String(row["Cód. classe"] || row["cod_classe"] || "").trim(),
          descricao_classe: String(row["Descrição classe"] || row["descricao_classe"] || "").trim(),
          trat_sementes: row["Trat. sementes"] || row["trat_sementes"] || null,
        }))
        .filter((row) => row.cod_aplic && row.descr_aplicacao);

      // Remove duplicates based on cod_aplic
      const uniqueRows = Array.from(
        new Map(rows.map((row) => [row.cod_aplic, row])).values()
      );

      const batchSize = 50;
      let importedTotal = 0;

      for (let i = 0; i < uniqueRows.length; i += batchSize) {
        const batch = uniqueRows.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from("calendario_aplicacoes")
          .upsert(batch, {
            onConflict: "cod_aplic",
            ignoreDuplicates: false,
          });

        if (error) {
          console.error("Erro ao importar batch:", error);
          toast.error(`Erro ao importar: ${error.message}`);
        } else {
          importedTotal += batch.length;
        }

        setImportProgress(Math.round((importedTotal / uniqueRows.length) * 100));
      }

      setImportedCount(importedTotal);
      setShowSummary(true);
      toast.success(`${importedTotal} registros importados com sucesso!`);
      setFile(null);
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Calendário de Aplicações</CardTitle>
        <CardDescription>
          Faça upload de uma planilha Excel com as colunas: Cód. aplic., Descr. aplicação, 
          Cód. aplic. ger., Cód. classe, Descrição classe, Trat. sementes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={isImporting}
          />
          <Button onClick={handleImport} disabled={isImporting || !file}>
            {isImporting ? "Importando..." : "Importar"}
          </Button>
        </div>

        {isImporting && (
          <div className="space-y-2">
            <Progress value={importProgress} />
            <p className="text-sm text-muted-foreground">
              Importando: {importProgress}%
            </p>
          </div>
        )}

        <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Importação Concluída</AlertDialogTitle>
              <AlertDialogDescription>
                {importedCount} registros foram importados com sucesso.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowSummary(false)}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
