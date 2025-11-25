/**
 * Remove termos de embalagem e normaliza o texto
 */
export function normalizeProductName(text: string | null | undefined): string {
  if (!text) return "";
  
  // Converte para maiúsculas e remove espaços extras
  let normalized = text.toUpperCase().trim().replace(/\s+/g, " ");
  
  // Remove termos de embalagem usando regex
  // Padrões: números + unidades (1LT, 5LT, 20LT, 1KG, etc)
  normalized = normalized.replace(/\s*-?\s*\d+\s*(LT|L|KG|G|ML|SACA|SACAS|BIG\s*BAG|LITRO|LITROS|KILO|KILOS|GRAMAS?)\s*-?\s*/gi, " ");
  
  // Remove termos específicos de embalagem
  normalized = normalized.replace(/\s*-?\s*(BIG\s*BAG|SACA|SACAS|LITRO|LITROS|KILO|KILOS|GRAMAS?)\s*-?\s*/gi, " ");
  
  // Remove múltiplos traços e espaços
  normalized = normalized.replace(/\s*-\s*-\s*/g, " - ");
  normalized = normalized.replace(/\s+/g, " ");
  
  // Remove traços no início e fim
  normalized = normalized.replace(/^\s*-\s*|\s*-\s*$/g, "");
  
  return normalized.trim();
}

/**
 * Normaliza texto removendo pluralidade (S no final) para comparação flexível
 */
export function normalizeWithoutPlural(text: string | null | undefined): string {
  const normalized = normalizeProductName(text);
  // Remove 'S' no final se a palavra tiver mais de 3 caracteres
  return normalized.length > 3 && normalized.endsWith('S') 
    ? normalized.slice(0, -1) 
    : normalized;
}

/**
 * Verifica se dois textos normalizados são iguais, ignorando pluralidade
 */
export function areProductsEqual(text1: string | null | undefined, text2: string | null | undefined): boolean {
  const normalized1 = normalizeWithoutPlural(text1);
  const normalized2 = normalizeWithoutPlural(text2);
  return normalized1 === normalized2 && normalized1 !== "";
}
