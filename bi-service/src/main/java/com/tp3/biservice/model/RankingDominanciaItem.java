package com.tp3.biservice.model;

public class RankingDominanciaItem {
    private String ticker;
    private Double dominancia;

    public RankingDominanciaItem() {}

    public RankingDominanciaItem(String ticker, Double dominancia) {
        this.ticker = ticker;
        this.dominancia = dominancia;
    }

    public String getTicker() {
        return ticker;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    public Double getDominancia() {
        return dominancia;
    }

    public void setDominancia(Double dominancia) {
        this.dominancia = dominancia;
    }
}
