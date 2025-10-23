const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

type ApiListResponse<T> = {
  items: T[];
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const apiGet = async <T>(path: string): Promise<T> => {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url);
  return handleResponse<T>(response);
};

export type CultivarRecord = {
  cultivar?: string;
  area?: string;
  quantidade?: number;
  data_plantio?: string;
  safra?: string;
  [key: string]: unknown;
};

export type AdubacaoRecord = {
  formulacao?: string;
  area?: string;
  dose?: number;
  total?: number;
  data_aplicacao?: string;
  responsavel?: string;
  [key: string]: unknown;
};

export type DefensivoRecord = {
  defensivo?: string;
  area?: string;
  dose?: number;
  data_aplicacao?: string;
  alvo?: string;
  [key: string]: unknown;
};

export const fetchCultivares = async (limit = 50) => {
  const data = await apiGet<ApiListResponse<CultivarRecord>>(`/cultivares?limit=${limit}`);
  return data.items;
};

export const fetchAdubacoes = async (limit = 50) => {
  const data = await apiGet<ApiListResponse<AdubacaoRecord>>(`/adubacoes?limit=${limit}`);
  return data.items;
};

export const fetchDefensivos = async (limit = 50) => {
  const data = await apiGet<ApiListResponse<DefensivoRecord>>(`/defensivos?limit=${limit}`);
  return data.items;
};

