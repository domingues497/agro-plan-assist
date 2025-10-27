import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export function ImportProdutores() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const payload = rows.map((row) => ({
        numerocm: String(row.NUMEROCM ?? row.numerocm ?? "").trim(),
        nome: String(row.NOME ?? row.nome ?? "").trim(),
        numerocm_consultor: String(row.NUMEROCMCONSULTOR ?? row.numerocm_consultor ?? "").trim(),
        consultor: row.CONSULTOR ? String(row.CONSULTOR).trim() : (row.consultor ? String(row.consultor).trim() : null),
      })).filter((r) => r.numerocm && r.nome && r.numerocm_consultor);

      if (payload.length === 0) {
        toast.error("Nenhuma linha válida encontrada (precisa de NUMEROCM, NOME, NUMEROCMCONSULTOR)");
        setIsImporting(false);
        return;
      }

      const { error } = await supabase.from("produtores").upsert(payload, { onConflict: "numerocm" });
      if (error) throw error;

      toast.success(`Importação de produtores concluída (${payload.length} registros)`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao importar produtores: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Produtores</CardTitle>
        <CardDescription>Planilha com colunas: NUMEROCM, NOME, NUMEROCMCONSULTOR, CONSULTOR</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Arquivo XLSX</Label>
          <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
        </div>
        <Button onClick={handleImport} disabled={isImporting || !file}>
          {isImporting ? "Importando..." : "Importar"}
        </Button>
      </CardContent>
    </Card>
  );
}