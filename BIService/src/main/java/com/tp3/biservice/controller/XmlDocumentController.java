package com.tp3.biservice.controller;

import com.tp3.biservice.model.XmlDocument;
import com.tp3.biservice.model.Summary;
import com.tp3.biservice.service.BIService;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class XmlDocumentController {
    private final BIService biService;

    public XmlDocumentController(BIService biService) {
        this.biService = biService;
    }

    @QueryMapping
    public List<XmlDocument> xmlData(@Argument String filter) {
        return biService.getXmlData(filter);
    }

    @QueryMapping
    public Summary summary(@Argument String filter) {
        return biService.getSummary(filter);
    }
}
