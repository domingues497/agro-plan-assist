import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export function ImportConsultores() {
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
        numerocm_consultor: String(row.NUMEROCMCONSULTOR ?? row.numerocm_consultor ?? "").trim(),
        consultor: String(row.CONSULTOR ?? row.consultor ?? "").trim(),
        email: String(row.EMAIL ?? row.email ?? "").trim().toLowerCase(),
      })).filter((r) => r.numerocm_consultor && r.consultor && r.email);

      if (payload.length === 0) {
        toast.error("Nenhuma linha válida encontrada (precisa de NUMEROCMCONSULTOR, CONSULTOR, EMAIL)");
        setIsImporting(false);
        return;
      }

      const { error } = await supabase.from("consultores").upsert(payload, { onConflict: "email" });
      if (error) throw error;

      toast.success(`Importação de consultores concluída (${payload.length} registros)`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao importar consultores: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Consultores</CardTitle>
        <CardDescription>Planilha com colunas: NUMEROCMCONSULTOR, CONSULTOR, EMAIL</CardDescription>
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