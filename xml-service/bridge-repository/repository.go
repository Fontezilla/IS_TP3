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

func (r *XmlRepository) GetEvolucaoPreco(ctx context.Context, ticker, from, to string) ([]EvolucaoPreco, error) {
	query := `
SELECT
  xt.ts,
  xt.preco
FROM xml_service.xml_documents d,
XMLTABLE(
  '/CryptoReport/AtivoCripto'
  PASSING d.xml_content::xml
  COLUMNS
    ticker TEXT PATH 'Identificacao/Ticker',
    preco NUMERIC PATH 'DadosMercado/PrecoAtual',
    ts TEXT PATH 'Metadados/Timestamp'
) xt
WHERE xt.ticker = $1
  AND xt.ts::timestamptz BETWEEN $2 AND $3
ORDER BY xt.ts;
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

func (r *XmlRepository) GetRankingPorDominancia(ctx context.Context, limit int) ([]RankingDominancia, error) {
	query := `
SELECT
  xt.ticker,
  xt.dominancia
FROM xml_service.xml_documents d,
XMLTABLE(
  '/CryptoReport/AtivoCripto'
  PASSING d.xml_content::xml
  COLUMNS
    ticker TEXT PATH 'Identificacao/Ticker',
    dominancia NUMERIC PATH 'MetricasAvancadas/DominanciaMercado'
) xt
WHERE xt.dominancia IS NOT NULL
ORDER BY xt.dominancia DESC
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

func (r *XmlRepository) GetPrecoMedioPorAtivo(ctx context.Context, from, to string) ([]PrecoMedioAtivo, error) {
	query := `
SELECT
  xt.ticker,
  AVG(xt.preco) AS preco_medio
FROM xml_service.xml_documents d,
XMLTABLE(
  '/CryptoReport/AtivoCripto'
  PASSING d.xml_content::xml
  COLUMNS
    ticker TEXT PATH 'Identificacao/Ticker',
    preco NUMERIC PATH 'DadosMercado/PrecoAtual',
    ts TEXT PATH 'Metadados/Timestamp'
) xt
WHERE xt.ts::timestamptz BETWEEN $1 AND $2
GROUP BY xt.ticker
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
