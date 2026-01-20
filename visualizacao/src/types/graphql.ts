// Tipos baseados no schema.graphqls do BI Service
export type EvolucaoPrecoItem = {
  timestamp: string;
  preco: number;
};

export type RankingDominanciaItem = {
  ticker: string;
  dominancia: number;
};

export type PrecoMedioItem = {
  ticker: string;
  precoMedio: number;
};

// Tipo para a resposta da consulta evolucaoPreco
export type EvolucaoPrecoResponse = {
  evolucaoPreco: EvolucaoPrecoItem[];
};

// Tipo para a resposta da consulta rankingDominancia
export type RankingDominanciaResponse = {
  rankingDominancia: RankingDominanciaItem[];
};

// Tipo para a resposta da consulta precoMedio
export type PrecoMedioResponse = {
  precoMedio: PrecoMedioItem[];
};
