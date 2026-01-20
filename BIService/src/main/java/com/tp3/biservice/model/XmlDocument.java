package com.tp3.biservice.model;

public class XmlDocument {
    private String id;
    private String content;
    private Metadata metadata;

    public XmlDocument() {
    }

    public XmlDocument(String id, String content, Metadata metadata) {
        this.id = id;
        this.content = content;
        this.metadata = metadata;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Metadata getMetadata() {
        return metadata;
    }

    public void setMetadata(Metadata metadata) {
        this.metadata = metadata;
    }
}
