package com.tp3.biservice.service;

import com.tp3.biservice.grpc.XmlRepositoryClient;
import com.tp3.biservice.model.EvolucaoPrecoItem;
import com.tp3.biservice.model.PrecoMedioItem;
import com.tp3.biservice.model.RankingDominanciaItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BIService {
    private static final Logger logger = LoggerFactory.getLogger(BIService.class);

    private final XmlRepositoryClient xmlRepositoryClient;

    public BIService(XmlRepositoryClient xmlRepositoryClient) {
        this.xmlRepositoryClient = xmlRepositoryClient;
    }

    public List<EvolucaoPrecoItem> getEvolucaoPreco(String ticker, String from, String to) {
        logger.info("Buscando evolucao de preco: ticker={}, from={}, to={}", ticker, from, to);
        List<EvolucaoPrecoItem> result = xmlRepositoryClient.getEvolucaoPreco(ticker, from, to);
        logger.info("Encontrados {} registros de evolucao de preco", result.size());
        return result;
    }

    public List<RankingDominanciaItem> getRankingDominancia(Integer limit) {
        int effectiveLimit = (limit != null && limit > 0) ? limit : 10;
        logger.info("Buscando ranking de dominancia: limit={}", effectiveLimit);
        List<RankingDominanciaItem> result = xmlRepositoryClient.getRankingDominancia(effectiveLimit);
        logger.info("Encontrados {} registros de ranking", result.size());
        return result;
    }

    public List<PrecoMedioItem> getPrecoMedio(String from, String to) {
        logger.info("Buscando preco medio: from={}, to={}", from, to);
        List<PrecoMedioItem> result = xmlRepositoryClient.getPrecoMedio(from, to);
        logger.info("Encontrados {} registros de preco medio", result.size());
        return result;
    }
}
