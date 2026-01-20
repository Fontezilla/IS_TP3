package main

import (
	"context"
	"database/sql"
	"fmt"

	"xml-service/common"

	_ "github.com/lib/pq"
)

type EvolucaoPreco struct {
	Timestamp string  `json:"timestamp"`
	Preco     float64 `json:"preco"`
}

type RankingDominancia struct {
	Ticker     string  `json:"ticker"`
	Dominancia float64 `json:"dominancia"`
}

type PrecoMedioAtivo struct {
	Ticker     string  `json:"ticker"`
	PrecoMedio float64 `json:"preco_medio"`
}

type XmlRepository struct {
	db *sql.DB
}

func NewXmlRepository() (*XmlRepository, error) {
	common.LoadEnv()

	dbURL := common.GetEnv("DATABASE_URL", "")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL nao definida")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return &XmlRepository{db: db}, nil
}

func (r *XmlRepository) Close() error {
	return r.db.Close()
}

// GetEvolucaoPreco retorna a evolucao do preco de um ticker num periodo
// Agrupa por timestamp para evitar duplicados e usa o preco medio se houver varios no mesmo momento
func (r *XmlRepository) GetEvolucaoPreco(ctx context.Context, ticker, from, to string) ([]EvolucaoPreco, error) {
	query := `
WITH dados AS (
  SELECT
    xt.ts,
    xt.preco
  FROM xml_service.xml_documents d,
  XMLTABLE(
    '/CryptoReport/AtivoCripto'
    PASSING CAST(d.xml_content AS xml)
    COLUMNS
      ticker TEXT PATH 'Identificacao/Ticker',
      preco NUMERIC PATH 'DadosMercado/PrecoAtual',
      ts TEXT PATH 'Metadados/Timestamp'
  ) xt
  WHERE xt.ticker = $1
    AND CAST(xt.ts AS timestamptz) BETWEEN CAST($2 AS timestamptz) AND CAST($3 AS timestamptz)
)
SELECT
  ts,
  AVG(preco) as preco
FROM dados
GROUP BY ts
ORDER BY ts;
`
	rows, err := r.db.QueryContext(ctx, query, ticker, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []EvolucaoPreco
	for rows.Next() {
		var e EvolucaoPreco
		if err := rows.Scan(&e.Timestamp, &e.Preco); err != nil {
			return nil, err
		}
		res = append(res, e)
	}

	return res, nil
}

// GetRankingPorDominancia retorna o ranking dos ativos por dominancia de mercado
// Usa apenas o registo mais recente de cada ticker para evitar duplicados
func (r *XmlRepository) GetRankingPorDominancia(ctx context.Context, limit int) ([]RankingDominancia, error) {
	query := `
WITH dados AS (
  SELECT
    xt.ticker,
    xt.dominancia,
    xt.ts,
    ROW_NUMBER() OVER (PARTITION BY xt.ticker ORDER BY CAST(xt.ts AS timestamptz) DESC) as rn
  FROM xml_service.xml_documents d,
  XMLTABLE(
    '/CryptoReport/AtivoCripto'
    PASSING CAST(d.xml_content AS xml)
    COLUMNS
      ticker TEXT PATH 'Identificacao/Ticker',
      dominancia NUMERIC PATH 'MetricasAvancadas/DominanciaMercado',
      ts TEXT PATH 'Metadados/Timestamp'
  ) xt
  WHERE xt.dominancia IS NOT NULL
)
SELECT ticker, dominancia
FROM dados
WHERE rn = 1
ORDER BY dominancia DESC
LIMIT $1;
`
	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []RankingDominancia
	for rows.Next() {
		var rnk RankingDominancia
		if err := rows.Scan(&rnk.Ticker, &rnk.Dominancia); err != nil {
			return nil, err
		}
		res = append(res, rnk)
	}

	return res, nil
}

// GetPrecoMedioPorAtivo retorna o preco medio de cada ativo num periodo
// Calcula a media de todos os registos temporais de cada ticker
func (r *XmlRepository) GetPrecoMedioPorAtivo(ctx context.Context, from, to string) ([]PrecoMedioAtivo, error) {
	query := `
WITH dados AS (
  SELECT
    xt.ticker,
    xt.preco,
    xt.ts
  FROM xml_service.xml_documents d,
  XMLTABLE(
    '/CryptoReport/AtivoCripto'
    PASSING CAST(d.xml_content AS xml)
    COLUMNS
      ticker TEXT PATH 'Identificacao/Ticker',
      preco NUMERIC PATH 'DadosMercado/PrecoAtual',
      ts TEXT PATH 'Metadados/Timestamp'
  ) xt
  WHERE CAST(xt.ts AS timestamptz) BETWEEN CAST($1 AS timestamptz) AND CAST($2 AS timestamptz)
)
SELECT
  ticker,
  AVG(preco) AS preco_medio
FROM dados
GROUP BY ticker
ORDER BY preco_medio DESC;
`
	rows, err := r.db.QueryContext(ctx, query, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []PrecoMedioAtivo
	for rows.Next() {
		var p PrecoMedioAtivo
		if err := rows.Scan(&p.Ticker, &p.PrecoMedio); err != nil {
			return nil, err
		}
		res = append(res, p)
	}

	return res, nil
}
