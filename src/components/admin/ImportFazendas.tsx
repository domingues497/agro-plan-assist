import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
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

export function ImportFazendas() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo XLSX primeiro");
      return;
    }

    try {
      setIsImporting(true);
      setImportedRows(0);
      setShowSummary(false);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const payload = rows.map((row) => ({
        numerocm: String(row.NUMEROCM ?? row.numerocm ?? "").trim(),
        idfazenda: String(row.IDFAZENDA ?? row.idfazenda ?? "").trim(),
        nomefazenda: String(row.NOMEFAZENDA ?? row.nomefazenda ?? "").trim(),
        numerocm_consultor: String(row.NUMEROCMCONSULTOR ?? row.numerocm_consultor ?? "").trim(),
        area_cultivavel: row.AREA_CULTIVAVEL ?? row.area_cultivavel ?? null,
      })).filter((r) => r.numerocm && r.idfazenda && r.nomefazenda && r.numerocm_consultor);

      if (payload.length === 0) {
        toast.error("Nenhuma linha válida encontrada (precisa de NUMEROCM, IDFAZENDA, NOMEFAZENDA, NUMEROCMCONSULTOR)");
        setIsImporting(false);
        return;
      }

      // Deduplicar por numerocm + idfazenda
      const dedupMap = new Map<string, typeof payload[0]>();
      for (const item of payload) {
        const key = `${item.numerocm}|${item.idfazenda}`;
        dedupMap.set(key, item);
      }
      const uniquePayload = Array.from(dedupMap.values());
      const removed = payload.length - uniquePayload.length;
      if (removed > 0) {
        toast.info(`${removed} registros duplicados foram ignorados`);
      }

      setTotalRows(uniquePayload.length);

      const batchSize = 100;
      let imported = 0;
      for (let i = 0; i < uniquePayload.length; i += batchSize) {
        const chunk = uniquePayload.slice(i, i + batchSize);
        const { error } = await supabase.from("fazendas").upsert(chunk, { 
          onConflict: "numerocm,idfazenda" 
        });
        if (error) {
          console.error("Erro ao importar chunk de fazendas:", error);
          toast.error(`Erro ao importar: ${error.message}`);
        } else {
          imported += chunk.length;
          setImportedRows(imported);
        }
      }

      toast.success(`Importação de fazendas concluída (${imported} de ${uniquePayload.length})`);
      setShowSummary(true);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao importar fazendas: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Fazendas</CardTitle>
        <CardDescription>Planilha com colunas: NUMEROCM, IDFAZENDA, NOMEFAZENDA, NUMEROCMCONSULTOR, AREA_CULTIVAVEL</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Arquivo XLSX</Label>
          <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
        </div>
        <Button onClick={handleImport} disabled={isImporting || !file}>
          {isImporting ? "Importando..." : "Importar"}
        </Button>
        {isImporting && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Importando {importedRows} de {totalRows} linhas...
            </p>
            <Progress value={totalRows ? Math.round((importedRows / totalRows) * 100) : 0} />
          </div>
        )}
      </CardContent>

      <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resumo da Importação</AlertDialogTitle>
            <AlertDialogDescription>
              Total na planilha: {totalRows}
              <br />
              Linhas importadas: {importedRows}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
