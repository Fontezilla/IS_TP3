package com.tp3.biservice.model;

public class Metadata {
    private String createdAt;
    private Integer size;

    public Metadata() {
    }

    public Metadata(String createdAt, Integer size) {
        this.createdAt = createdAt;
        this.size = size;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public Integer getSize() {
        return size;
    }

    public void setSize(Integer size) {
        this.size = size;
    }
}
