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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ImportCalendarioAplicacoes = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setTotalRows(0);
    setImportedRows(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      setTotalRows(jsonData.length);

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        
        const { error } = await (supabase as any)
          .from("calendario_aplicacoes")
          .upsert({
            cod_aplic: row["Cód. aplic."] || row["cod_aplic"] || "",
            descr_aplicacao: row["Descr. aplicação"] || row["descr_aplicacao"] || "",
            cod_aplic_ger: row["Cód. aplic. ger."] || row["cod_aplic_ger"] || null,
            cod_classe: row["Cód. classe"] || row["cod_classe"] || "",
            descricao_classe: row["Descrição classe"] || row["descricao_classe"] || "",
            trat_sementes: row["Trat. sementes"] || row["trat_sementes"] || null,
          }, {
            onConflict: "cod_aplic",
            ignoreDuplicates: false
          });

        if (error) {
          console.error("Erro ao importar linha:", error);
        }

        setImportedRows(i + 1);
      }

      toast.success(`${jsonData.length} registros importados com sucesso!`);
      setShowSummary(true);
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast.error("Erro ao importar arquivo");
    } finally {
      setIsImporting(false);
      event.target.value = "";
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
            onChange={handleFileUpload}
            disabled={isImporting}
          />
          <Button disabled={isImporting}>
            {isImporting ? "Importando..." : "Upload"}
          </Button>
        </div>

        {isImporting && (
          <div className="space-y-2">
            <Progress value={(importedRows / totalRows) * 100} />
            <p className="text-sm text-muted-foreground">
              Importando: {importedRows} de {totalRows}
            </p>
          </div>
        )}

        <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Importação Concluída</AlertDialogTitle>
              <AlertDialogDescription>
                {importedRows} registros foram importados com sucesso.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
