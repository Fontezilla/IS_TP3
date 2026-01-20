package com.tp3.biservice.model;

public class EvolucaoPrecoItem {
    private String timestamp;
    private Double preco;

    public EvolucaoPrecoItem() {}

    public EvolucaoPrecoItem(String timestamp, Double preco) {
        this.timestamp = timestamp;
        this.preco = preco;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public Double getPreco() {
        return preco;
    }

    public void setPreco(Double preco) {
        this.preco = preco;
    }
}
