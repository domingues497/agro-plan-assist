import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32', // Primary green color
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 5,
  },
  section: {
    margin: 10,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: 200,
    fontSize: 12,
    fontWeight: 'bold',
  },
  value: {
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 10,
    color: '#999999',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
  },
});

interface RelatorioPDFProps {
  data: {
    cultivares: number;
    quantidadeSementes: number;
    hectares: number;
    adubacoes: number;
    volumeAdubacao: number;
    defensivos: number;
    volumeDefensivo: number;
    safra: string;
  };
}

export const RelatorioPDF = ({ data }: RelatorioPDFProps) => (
  <Document>
    <Page size="A4" orientation="portrait" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>AgroPlan Assist</Text>
        <Text style={styles.subtitle}>Relatório Consolidado de Atividades</Text>
        <Text style={styles.subtitle}>Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Filtros</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Safra Selecionada:</Text>
          <Text style={styles.value}>{data.safra || "Todas"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo de Cultivares</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Cultivares Ativos:</Text>
          <Text style={styles.value}>{data.cultivares}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Qtd. Sementes (Sac/Kg):</Text>
          <Text style={styles.value}>{data.quantidadeSementes.toLocaleString('pt-BR')}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Área Total (ha):</Text>
          <Text style={styles.value}>{data.hectares.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo de Adubações</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Programações:</Text>
          <Text style={styles.value}>{data.adubacoes}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Volume Total (Kg/L):</Text>
          <Text style={styles.value}>{data.volumeAdubacao.toLocaleString('pt-BR')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo de Defensivos</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Aplicações Programadas:</Text>
          <Text style={styles.value}>{data.defensivos}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Volume Total (Kg/L):</Text>
          <Text style={styles.value}>{data.volumeDefensivo.toLocaleString('pt-BR')}</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        AgroPlan Assist - Sistema de Gestão Agrícola
      </Text>
    </Page>
  </Document>
);
