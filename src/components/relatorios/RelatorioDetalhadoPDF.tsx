import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 20,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 3,
    textAlign: "center",
    color: "#444444",
  },
  table: {
    display: "flex",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#bfbfbf",
    marginBottom: 10,
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row",
    minHeight: 25,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#bfbfbf",
  },
  tableHeader: {
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
    fontSize: 8,
  },
  tableCell: {
    margin: 2,
    fontSize: 7,
    padding: 2,
  },
  // Column widths
  colProdutor: { width: "12%" },
  colImovel: { width: "12%" },
  colGleba: { width: "10%" },
  colCultivar: { width: "12%" },
  colData: { width: "8%" },
  colTipo: { width: "8%" },
  colPlantas: { width: "6%" },
  colEspacamento: { width: "6%" },
  colArea: { width: "6%" },
  colDefensivos: { width: "13%" },
  colAdubacoes: { width: "13%" },
  
  footer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    fontSize: 8,
    textAlign: "center",
    color: "#888888",
  },
});

export interface ProductItem {
  data: string;
  produto: string;
  quant_ha: string;
  total_kg: string;
  area_aplicada: string;
  proprio: string;
  emb: string;
}

export interface CultivarItem {
  cultura: string;
  cultivar: string;
  data_plantio: string;
  plantas_m2: string;
  epoca: string;
  area_ha: string;
  propria: string;
  emb: string;
  tratamento: string;
  tipo_especifico: string;
  percent_plant: string;
}

export interface DetailedReportItem {
  produtor: string;
  imovel: string;
  gleba: string;
  cultivares: CultivarItem[];
  produtos: ProductItem[];
}

interface RelatorioDetalhadoPDFProps {
  data: DetailedReportItem[];
  produtorFilter?: string;
  safraFilter?: string;
}

const formatCurrency = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  return isNaN(num) ? value : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const RelatorioDetalhadoPDF = ({ data, produtorFilter, safraFilter }: RelatorioDetalhadoPDFProps) => (
  <Document>
    <Page size="A4" orientation="portrait" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>AgroPlan - Relatório Detalhado</Text>
        <Text style={styles.subtitle}>
          {produtorFilter ? `Produtor: ${produtorFilter}` : "Todos os Produtores"}
          {safraFilter ? ` | Safra: ${safraFilter}` : ""}
        </Text>
        <Text style={styles.subtitle}>
          Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
        </Text>
      </View>

      {data.map((item, index) => (
        <View key={index} style={{ marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 10 }}>
          {/* Header Row: Imovel and Talhao */}
          <View style={{ flexDirection: 'row', marginBottom: 5 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', width: '60%' }}>
              Imóvel: <Text style={{ fontWeight: 'normal' }}>{item.imovel}</Text>
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold', width: '40%' }}>
              Talhão: <Text style={{ fontWeight: 'normal' }}>{item.gleba}</Text>
            </Text>
          </View>

          {/* Cultivares List */}
          {item.cultivares && item.cultivares.length > 0 ? (
            item.cultivares.map((cult, cIdx) => (
              <View key={cIdx} style={{ marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 }}>
                {/* Sub-header: Cultura and Cultivar */}
                <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                  <Text style={{ fontSize: 10, width: '30%' }}>
                    Cultura: {cult.cultura}
                  </Text>
                  <Text style={{ fontSize: 10, width: '70%' }}>
                    Cultivar - {cult.cultivar}
                  </Text>
                </View>

                {/* Additional Details Row 1: Embalagem, Tratamento */}
                <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                  <Text style={{ fontSize: 9, width: '30%' }}>
                    Embalagem: {cult.emb}
                  </Text>
                  <Text style={{ fontSize: 9, width: '70%' }}>
                    Tratamento: {cult.tratamento}
                  </Text>
                </View>

                {/* Info Row Headers */}
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 2, marginBottom: 2 }}>
                  <Text style={{ fontSize: 9, width: '15%' }}>Data Plantio</Text>
                  <Text style={{ fontSize: 9, width: '15%' }}>Sementes/m²</Text>
                  <Text style={{ fontSize: 9, width: '15%' }}>% Cobertura</Text>
                  <Text style={{ fontSize: 9, width: '15%' }}>Área (ha)</Text>
                  <Text style={{ fontSize: 9, width: '10%' }}>Própria</Text>
                  <Text style={{ fontSize: 9, width: '15%' }}>Época</Text>
                </View>

                {/* Info Row Values */}
                <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                  <Text style={{ fontSize: 9, width: '15%' }}>{cult.data_plantio}</Text>
                  <Text style={{ fontSize: 9, width: '15%' }}>{cult.plantas_m2}</Text>
                  <Text style={{ fontSize: 9, width: '15%' }}>{cult.percent_plant}</Text>
                  <Text style={{ fontSize: 9, width: '15%' }}>{cult.area_ha}</Text>
                  <Text style={{ fontSize: 9, width: '10%' }}>{cult.propria}</Text>
                  <Text style={{ fontSize: 9, width: '15%' }}>{cult.epoca}</Text>
                </View>

                {/* Tipo Especifico */}
                {cult.tipo_especifico && cult.tipo_especifico !== '-' && (
                  <View style={{ marginBottom: 5 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Tipo Específico: <Text style={{ fontWeight: 'normal' }}>{cult.tipo_especifico}</Text></Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 9, fontStyle: 'italic', color: '#666', marginBottom: 5 }}>
              Nenhuma cultivar registrada.
            </Text>
          )}

          {/* Products Table */}
          <View style={{ marginTop: 5 }}>
            {/* Products Header */}
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 2, marginBottom: 2 }}>
              <Text style={{ fontSize: 9, width: '15%' }}>Data</Text>
              <Text style={{ fontSize: 9, width: '25%' }}>Produto</Text>
              <Text style={{ fontSize: 9, width: '12%', textAlign: 'right' }}>Quant./ha</Text>
              <Text style={{ fontSize: 9, width: '12%', textAlign: 'right' }}>Total kg</Text>
              <Text style={{ fontSize: 9, width: '12%', textAlign: 'right' }}>Área (ha)</Text>
              <Text style={{ fontSize: 9, width: '12%', textAlign: 'center' }}>Próprio</Text>
              <Text style={{ fontSize: 9, width: '12%', textAlign: 'center' }}>Emb</Text>
            </View>

            {/* Products Rows */}
            {item.produtos && item.produtos.map((prod, idx) => (
              <View key={idx} style={{ flexDirection: 'row', marginBottom: 2 }}>
                <Text style={{ fontSize: 9, width: '15%' }}>{prod.data}</Text>
                <Text style={{ fontSize: 9, width: '25%' }}>{prod.produto}</Text>
                <Text style={{ fontSize: 9, width: '12%', textAlign: 'right' }}>{prod.quant_ha}</Text>
                <Text style={{ fontSize: 9, width: '12%', textAlign: 'right' }}>{prod.total_kg}</Text>
                <Text style={{ fontSize: 9, width: '12%', textAlign: 'right' }}>{prod.area_aplicada}</Text>
                <Text style={{ fontSize: 9, width: '12%', textAlign: 'center' }}>{prod.proprio}</Text>
                <Text style={{ fontSize: 9, width: '12%', textAlign: 'center' }}>{prod.emb}</Text>
              </View>
            ))}
            {(!item.produtos || item.produtos.length === 0) && (
              <Text style={{ fontSize: 9, fontStyle: 'italic', color: '#666', marginTop: 2 }}>
                Nenhum produto registrado.
              </Text>
            )}
          </View>
        </View>
      ))}

      <Text style={styles.footer}>
        AgroPlan Assist - Sistema de Planejamento Agrícola
      </Text>
    </Page>
  </Document>
);
