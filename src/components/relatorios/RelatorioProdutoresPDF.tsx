import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Produtor } from '@/hooks/useProdutores';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    paddingTop: 20,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 65,
    fontSize: 10,
  },
  header: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: '#e5e7eb',
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 25,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#f9fafb',
    fontWeight: 'bold',
    minHeight: 30,
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#e5e7eb',
    padding: 5,
  },
  tableCell: {
    fontSize: 9,
    padding: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 8,
    color: '#999999',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
  },
});

interface RelatorioProdutoresPDFProps {
  produtores: Produtor[];
}

export const RelatorioProdutoresPDF = ({ produtores }: RelatorioProdutoresPDFProps) => {
  const formatBoolean = (value?: boolean) => value ? "Sim" : "Não";
  
  const getCooperadoStatus = (produtor: Produtor) => {
    const isClosed = produtor.compra_insumos && produtor.entrega_producao && produtor.paga_assistencia;
    return isClosed ? "FECHADO" : "ABERTO";
  };

  const ITEMS_PER_PAGE = 12;
  const chunks = [];
  for (let i = 0; i < produtores.length; i += ITEMS_PER_PAGE) {
    chunks.push(produtores.slice(i, i + ITEMS_PER_PAGE));
  }

  if (chunks.length === 0) {
    return (
      <Document>
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Relatório de Produtores</Text>
            <Text style={styles.subtitle}>Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</Text>
          </View>
          <Text>Nenhum produtor encontrado.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {chunks.map((chunk, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Relatório de Produtores</Text>
            <Text style={styles.subtitle}>Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} - Página {pageIndex + 1} de {chunks.length}</Text>
          </View>

          <View style={styles.table}>
            {/* Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <View style={[styles.tableCol, { width: '8%' }]}>
                <Text style={styles.tableCell}>Número CM</Text>
              </View>
              <View style={[styles.tableCol, { width: '22%' }]}>
                <Text style={styles.tableCell}>Nome</Text>
              </View>
              <View style={[styles.tableCol, { width: '21%' }]}>
                <Text style={styles.tableCell}>Consultor</Text>
              </View>
              <View style={[styles.tableCol, { width: '11%' }]}>
                <Text style={styles.tableCell}>Compra Insumos</Text>
              </View>
              <View style={[styles.tableCol, { width: '11%' }]}>
                <Text style={styles.tableCell}>Entrega Produção</Text>
              </View>
              <View style={[styles.tableCol, { width: '11%' }]}>
                <Text style={styles.tableCell}>Paga Assistência</Text>
              </View>
              <View style={[styles.tableCol, { width: '16%' }]}>
                <Text style={styles.tableCell}>Cooperado</Text>
              </View>
            </View>

            {/* Rows */}
            {chunk.map((produtor) => (
              <View style={styles.tableRow} key={produtor.id}>
                <View style={[styles.tableCol, { width: '8%' }]}>
                  <Text style={styles.tableCell}>{produtor.numerocm}</Text>
                </View>
                <View style={[styles.tableCol, { width: '22%' }]}>
                  <Text style={styles.tableCell}>{produtor.nome}</Text>
                </View>
                <View style={[styles.tableCol, { width: '21%' }]}>
                  <Text style={styles.tableCell}>{produtor.consultor || "-"}</Text>
                </View>
                <View style={[styles.tableCol, { width: '11%' }]}>
                  <Text style={styles.tableCell}>{formatBoolean(produtor.compra_insumos)}</Text>
                </View>
                <View style={[styles.tableCol, { width: '11%' }]}>
                  <Text style={styles.tableCell}>{formatBoolean(produtor.entrega_producao)}</Text>
                </View>
                <View style={[styles.tableCol, { width: '11%' }]}>
                  <Text style={styles.tableCell}>{formatBoolean(produtor.paga_assistencia)}</Text>
                </View>
                <View style={[styles.tableCol, { width: '16%' }]}>
                  <Text style={styles.tableCell}>{getCooperadoStatus(produtor)}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.footer}>
            AgroPlan Assist - Sistema de Gestão Agrícola - Página {pageIndex + 1} de {chunks.length}
          </Text>
        </Page>
      ))}
    </Document>
  );
};
