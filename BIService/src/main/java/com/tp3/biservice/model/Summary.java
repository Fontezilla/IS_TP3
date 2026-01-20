package com.tp3.biservice.model;

public class Summary {
    private Integer total;
    private Double averageSize;

    public Summary() {
    }

    public Summary(Integer total, Double averageSize) {
        this.total = total;
        this.averageSize = averageSize;
    }

    public Integer getTotal() {
        return total;
    }

    public void setTotal(Integer total) {
        this.total = total;
    }

    public Double getAverageSize() {
        return averageSize;
    }

    public void setAverageSize(Double averageSize) {
        this.averageSize = averageSize;
    }
}
