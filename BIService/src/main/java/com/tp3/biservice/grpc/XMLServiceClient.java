package com.tp3.biservice.grpc;

import com.tp3.xmlservice.QueryRequest;
import com.tp3.xmlservice.QueryResponse;
import com.tp3.xmlservice.XMLServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.springframework.stereotype.Service;

@Service
public class XMLServiceClient {
    private final XMLServiceGrpc.XMLServiceBlockingStub xmlServiceStub;

    public XMLServiceClient() {
        ManagedChannel channel = ManagedChannelBuilder.forAddress("xmlservice", 50051)
                .usePlaintext()
                .build();
        this.xmlServiceStub = XMLServiceGrpc.newBlockingStub(channel);
    }

    public byte[] queryXML(String filter) {
        QueryResponse response = xmlServiceStub.queryXML(QueryRequest.newBuilder().setFilter(filter).build());
        return response.getData().toByteArray();
    }
}
