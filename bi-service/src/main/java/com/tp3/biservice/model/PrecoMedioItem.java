package com.tp3.biservice.model;

public class PrecoMedioItem {
    private String ticker;
    private Double precoMedio;

    public PrecoMedioItem() {}

    public PrecoMedioItem(String ticker, Double precoMedio) {
        this.ticker = ticker;
        this.precoMedio = precoMedio;
    }

    public String getTicker() {
        return ticker;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    public Double getPrecoMedio() {
        return precoMedio;
    }

    public void setPrecoMedio(Double precoMedio) {
        this.precoMedio = precoMedio;
    }
}
