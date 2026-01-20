package com.tp3.biservice.service;

import com.tp3.biservice.grpc.XMLServiceClient;
import com.tp3.biservice.model.XmlDocument;
import com.tp3.biservice.model.Metadata;
import com.tp3.biservice.model.Summary;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BIService {
    private final XMLServiceClient xmlServiceClient;

    public BIService(XMLServiceClient xmlServiceClient) {
        this.xmlServiceClient = xmlServiceClient;
    }

    public List<XmlDocument> getXmlData(String filter) {
        byte[] xmlData = xmlServiceClient.queryXML(filter);
        // Transforma os dados XML em objetos Java
        return List.of(transformToXmlDocument(xmlData));
    }

    public Summary getSummary(String filter) {
        List<XmlDocument> documents = getXmlData(filter);
        int total = documents.size();
        double averageSize = documents.stream()
                .mapToInt(doc -> doc.getMetadata().getSize())
                .average()
                .orElse(0.0);
        return new Summary(total, averageSize);
    }

    private XmlDocument transformToXmlDocument(byte[] xmlData) {
        XmlDocument doc = new XmlDocument();
        doc.setId("1");
        doc.setContent(new String(xmlData));
        Metadata metadata = new Metadata();
        metadata.setCreatedAt("2026-01-19");
        metadata.setSize(xmlData.length);
        doc.setMetadata(metadata);
        return doc;
    }
}
