import React from 'react';
import { Page, Text, View, Document, StyleSheet, Svg, Polygon, G, Image } from '@react-pdf/renderer';
import { processGeoJsonToSvg, getSatelliteImageUrl } from '@/lib/mapUtils';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
  },
  farmContainer: {
    marginBottom: 20,
    breakInside: 'avoid',
  },
  farmHeader: {
    backgroundColor: '#f3f4f6',
    padding: 10,
    marginBottom: 10,
    borderRadius: 4,
  },
  farmTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  talhaoCard: {
    width: '48%', // 2 items per row
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    backgroundColor: '#fafafa',
  },
  talhaoImageContainer: {
    width: 100,
    height: 100,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  talhaoInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  talhaoName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  talhaoArea: {
    fontSize: 10,
    color: '#333',
    marginBottom: 4,
  },
  talhaoLocationLabel: {
    fontSize: 8,
    color: '#888',
    marginTop: 4,
  },
  talhaoLocation: {
    fontSize: 9,
    color: '#444',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: 'grey',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
});

const TalhaoThumbnailPDF = ({ geojson }: { geojson: any }) => {
  const data = processGeoJsonToSvg(geojson);
  
  if (!data) return null;

  const mapUrl = getSatelliteImageUrl(data.bbox);

  return (
    <View style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Image 
            src={mapUrl} 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} 
        />
        <Svg viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <G transform={`translate(${data.translateX}, ${data.translateY})`}>
                {data.polygons.map((points, idx) => (
                <Polygon 
                    key={idx} 
                    points={points} 
                    fillOpacity={0.3}
                    fill="#fed7aa" 
                    stroke="#f97316" 
                    strokeWidth={2} 
                />
                ))}
            </G>
        </Svg>
    </View>
  );
};

export const RelatorioMapaFazendasPDF = ({ data }: { data: any[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Relatório Mapa de Fazendas</Text>
        <Text style={styles.subtitle}>Gerado em {new Date().toLocaleDateString('pt-BR')}</Text>
      </View>

      {data.map((farm, idx) => (
        <View key={idx} style={styles.farmContainer} wrap={false}>
          <View style={styles.farmHeader}>
            <Text style={styles.farmTitle}>{farm.fazenda} - {farm.produtor}</Text>
          </View>
          
          <View style={styles.grid}>
            {farm.talhoes.map((t: any) => (
              <View key={t.id} style={styles.talhaoCard}>
                <View style={styles.talhaoImageContainer}>
                   <TalhaoThumbnailPDF geojson={t.geojson} />
                </View>
                <View style={styles.talhaoInfo}>
                  <Text style={styles.talhaoName}>{t.nome}</Text>
                  <Text style={styles.talhaoArea}>Área: {t.area} ha</Text>
                  {t.localizacao?.cidade && (
                    <>
                      <Text style={styles.talhaoLocationLabel}>Localização:</Text>
                      <Text style={styles.talhaoLocation}>
                        {t.localizacao.cidade} - {t.localizacao.estado}
                      </Text>
                      {t.localizacao.bairro && (
                         <Text style={styles.talhaoLocation}>{t.localizacao.bairro}</Text>
                      )}
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
        `Página ${pageNumber} de ${totalPages} - Agro Plan Assist`
      )} fixed />
    </Page>
  </Document>
);
