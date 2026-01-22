import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 10,
  },
  logo: {
    width: 150,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#111827",
  },
  subtitle: {
    fontSize: 12,
    color: "#4B5563",
  },
  table: {
    display: "flex",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: "#e5e7eb",
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row",
  },
  tableCol: {
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#e5e7eb",
    padding: 5,
  },
  tableHeader: {
    backgroundColor: "#f9fafb",
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
  },
  tableCell: {
    fontSize: 9,
    color: "#4b5563",
  },
  totalRow: {
    backgroundColor: "#f3f4f6",
    fontWeight: "bold",
  }
});

interface ResumoItem {
  consultor: string;
  produtor: string;
  area_fisica: number;
  area_programada: number;
}

interface RelatorioResumoConsultorProdutorPDFProps {
  data: ResumoItem[];
  safra: string;
  cultura: string;
}

export const RelatorioResumoConsultorProdutorPDF = ({ data, safra, cultura }: RelatorioResumoConsultorProdutorPDFProps) => {
  const totalAreaFisica = data.reduce((acc, item) => acc + item.area_fisica, 0);
  const totalAreaProgramada = data.reduce((acc, item) => acc + item.area_programada, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* Logo placeholder if needed */}
          <Text style={styles.title}>Resumo Consultor - Produtor</Text>
          <Text style={styles.subtitle}>Safra: {safra || "Todas"} | Cultura: {cultura || "Todas"}</Text>
          <Text style={styles.subtitle}>Gerado em: {new Date().toLocaleDateString()}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.tableCol, styles.tableHeader, { width: "30%" }]}>
              <Text>Consultor</Text>
            </View>
            <View style={[styles.tableCol, styles.tableHeader, { width: "30%" }]}>
              <Text>Produtor</Text>
            </View>
            <View style={[styles.tableCol, styles.tableHeader, { width: "20%" }]}>
              <Text>Área Física (ha)</Text>
            </View>
            <View style={[styles.tableCol, styles.tableHeader, { width: "20%" }]}>
              <Text>Área Programada (ha)</Text>
            </View>
          </View>

          {data.map((item, index) => (
            <View style={styles.tableRow} key={index}>
              <View style={[styles.tableCol, { width: "30%" }]}>
                <Text style={styles.tableCell}>{item.consultor}</Text>
              </View>
              <View style={[styles.tableCol, { width: "30%" }]}>
                <Text style={styles.tableCell}>{item.produtor}</Text>
              </View>
              <View style={[styles.tableCol, { width: "20%" }]}>
                <Text style={styles.tableCell}>{item.area_fisica.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={[styles.tableCol, { width: "20%" }]}>
                <Text style={styles.tableCell}>{item.area_programada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            </View>
          ))}

          <View style={[styles.tableRow, styles.totalRow]}>
            <View style={[styles.tableCol, { width: "60%" }]}>
              <Text style={[styles.tableCell, { fontWeight: "bold", textAlign: "right" }]}>Total Geral:</Text>
            </View>
            <View style={[styles.tableCol, { width: "20%" }]}>
              <Text style={[styles.tableCell, { fontWeight: "bold" }]}>{totalAreaFisica.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <View style={[styles.tableCol, { width: "20%" }]}>
              <Text style={[styles.tableCell, { fontWeight: "bold" }]}>{totalAreaProgramada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};
