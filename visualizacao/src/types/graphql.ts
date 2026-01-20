export type EvolucaoPrecoItem = {
  timestamp: string;
  preco: number;
};

export type EvolucaoPrecoResponse = {
  evolucaoPreco: EvolucaoPrecoItem[];
};

export type RankingDominanciaItem = {
  ticker: string;
  dominancia: number;
};

export type RankingDominanciaResponse = {
  rankingDominancia: RankingDominanciaItem[];
};

export type PrecoMedioItem = {
  ticker: string;
  precoMedio: number;
};

export type PrecoMedioResponse = {
  precoMedio: PrecoMedioItem[];
};
