package com.tp3.biservice.grpc;

import com.tp3.biservice.grpc.proto.*;
import com.tp3.biservice.model.EvolucaoPrecoItem;
import com.tp3.biservice.model.PrecoMedioItem;
import com.tp3.biservice.model.RankingDominanciaItem;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class XmlRepositoryClient {
    private static final Logger logger = LoggerFactory.getLogger(XmlRepositoryClient.class);

    @Value("${grpc.client.xml-repository.address:localhost}")
    private String grpcAddress;

    @Value("${grpc.client.xml-repository.port:50051}")
    private int grpcPort;

    private ManagedChannel channel;
    private XmlRepositoryServiceGrpc.XmlRepositoryServiceBlockingStub blockingStub;

    @PostConstruct
    public void init() {
        logger.info("Conectando ao XML Repository Service em {}:{}", grpcAddress, grpcPort);
        channel = ManagedChannelBuilder.forAddress(grpcAddress, grpcPort)
                .usePlaintext()
                .build();
        blockingStub = XmlRepositoryServiceGrpc.newBlockingStub(channel);
        logger.info("Conexao gRPC estabelecida com sucesso");
    }

    @PreDestroy
    public void shutdown() {
        if (channel != null) {
            try {
                channel.shutdown().awaitTermination(5, TimeUnit.SECONDS);
                logger.info("Canal gRPC encerrado");
            } catch (InterruptedException e) {
                logger.error("Erro ao encerrar canal gRPC", e);
                Thread.currentThread().interrupt();
            }
        }
    }

    public List<EvolucaoPrecoItem> getEvolucaoPreco(String ticker, String from, String to) {
        try {
            logger.debug("Chamando GetEvolucaoPreco: ticker={}, from={}, to={}", ticker, from, to);

            EvolucaoPrecoRequest request = EvolucaoPrecoRequest.newBuilder()
                    .setTicker(ticker)
                    .setFrom(from)
                    .setTo(to)
                    .build();

            EvolucaoPrecoResponse response = blockingStub.getEvolucaoPreco(request);

            List<EvolucaoPrecoItem> items = response.getItemsList().stream()
                    .map(item -> new EvolucaoPrecoItem(item.getTimestamp(), item.getPreco()))
                    .collect(Collectors.toList());

            logger.debug("GetEvolucaoPreco retornou {} items", items.size());
            return items;
        } catch (StatusRuntimeException e) {
            logger.error("Erro gRPC ao chamar GetEvolucaoPreco: {}", e.getStatus(), e);
            return Collections.emptyList();
        }
    }

    public List<RankingDominanciaItem> getRankingDominancia(int limit) {
        try {
            logger.debug("Chamando GetRankingDominancia: limit={}", limit);

            RankingDominanciaRequest request = RankingDominanciaRequest.newBuilder()
                    .setLimit(limit)
                    .build();

            RankingDominanciaResponse response = blockingStub.getRankingDominancia(request);

            List<RankingDominanciaItem> items = response.getItemsList().stream()
                    .map(item -> new RankingDominanciaItem(item.getTicker(), item.getDominancia()))
                    .collect(Collectors.toList());

            logger.debug("GetRankingDominancia retornou {} items", items.size());
            return items;
        } catch (StatusRuntimeException e) {
            logger.error("Erro gRPC ao chamar GetRankingDominancia: {}", e.getStatus(), e);
            return Collections.emptyList();
        }
    }

    public List<PrecoMedioItem> getPrecoMedio(String from, String to) {
        try {
            logger.debug("Chamando GetPrecoMedio: from={}, to={}", from, to);

            PrecoMedioRequest request = PrecoMedioRequest.newBuilder()
                    .setFrom(from)
                    .setTo(to)
                    .build();

            PrecoMedioResponse response = blockingStub.getPrecoMedio(request);

            List<PrecoMedioItem> items = response.getItemsList().stream()
                    .map(item -> new PrecoMedioItem(item.getTicker(), item.getPrecoMedio()))
                    .collect(Collectors.toList());

            logger.debug("GetPrecoMedio retornou {} items", items.size());
            return items;
        } catch (StatusRuntimeException e) {
            logger.error("Erro gRPC ao chamar GetPrecoMedio: {}", e.getStatus(), e);
            return Collections.emptyList();
        }
    }
}
