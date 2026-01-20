package com.tp3.biservice.controller;

import com.tp3.biservice.model.EvolucaoPrecoItem;
import com.tp3.biservice.model.PrecoMedioItem;
import com.tp3.biservice.model.RankingDominanciaItem;
import com.tp3.biservice.service.BIService;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class CryptoController {
    private final BIService biService;

    public CryptoController(BIService biService) {
        this.biService = biService;
    }

    @QueryMapping
    public List<EvolucaoPrecoItem> evolucaoPreco(
            @Argument String ticker,
            @Argument String from,
            @Argument String to) {
        return biService.getEvolucaoPreco(ticker, from, to);
    }

    @QueryMapping
    public List<RankingDominanciaItem> rankingDominancia(@Argument Integer limit) {
        return biService.getRankingDominancia(limit);
    }

    @QueryMapping
    public List<PrecoMedioItem> precoMedio(
            @Argument String from,
            @Argument String to) {
        return biService.getPrecoMedio(from, to);
    }
}
