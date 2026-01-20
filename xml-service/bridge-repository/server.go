package main

import (
	"context"
	"log"
	"net"

	"xml-service/bridge-repository/proto"
	"xml-service/common"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type grpcServer struct {
	proto.UnimplementedXmlRepositoryServiceServer
	repo *XmlRepository
}

func (s *grpcServer) GetEvolucaoPreco(ctx context.Context, req *proto.EvolucaoPrecoRequest) (*proto.EvolucaoPrecoResponse, error) {
	log.Printf("GetEvolucaoPreco: ticker=%s, from=%s, to=%s", req.Ticker, req.From, req.To)
	res, err := s.repo.GetEvolucaoPreco(ctx, req.Ticker, req.From, req.To)
	if err != nil {
		log.Printf("Erro GetEvolucaoPreco: %v", err)
		return nil, err
	}
	log.Printf("GetEvolucaoPreco: encontrados %d registros", len(res))

	var items []*proto.EvolucaoPrecoItem
	for _, r := range res {
		items = append(items, &proto.EvolucaoPrecoItem{
			Timestamp: r.Timestamp,
			Preco:     r.Preco,
		})
	}

	return &proto.EvolucaoPrecoResponse{Items: items}, nil
}

func (s *grpcServer) GetRankingDominancia(ctx context.Context, req *proto.RankingDominanciaRequest) (*proto.RankingDominanciaResponse, error) {
	limit := int(req.Limit)
	if limit <= 0 {
		limit = 10
	}

	res, err := s.repo.GetRankingPorDominancia(ctx, limit)
	if err != nil {
		return nil, err
	}

	var items []*proto.RankingDominanciaItem
	for _, r := range res {
		items = append(items, &proto.RankingDominanciaItem{
			Ticker:     r.Ticker,
			Dominancia: r.Dominancia,
		})
	}

	return &proto.RankingDominanciaResponse{Items: items}, nil
}

func (s *grpcServer) GetPrecoMedio(ctx context.Context, req *proto.PrecoMedioRequest) (*proto.PrecoMedioResponse, error) {
	res, err := s.repo.GetPrecoMedioPorAtivo(ctx, req.From, req.To)
	if err != nil {
		return nil, err
	}

	var items []*proto.PrecoMedioItem
	for _, r := range res {
		items = append(items, &proto.PrecoMedioItem{
			Ticker:     r.Ticker,
			PrecoMedio: r.PrecoMedio,
		})
	}

	return &proto.PrecoMedioResponse{Items: items}, nil
}

func main() {
	common.LoadEnv()

	repo, err := NewXmlRepository()
	if err != nil {
		log.Fatalf("Erro ao conectar BD: %v", err)
	}
	defer repo.Close()

	port := common.GetEnv("GRPC_PORT", "50051")
	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("Erro ao iniciar listener: %v", err)
	}

	s := grpc.NewServer()
	proto.RegisterXmlRepositoryServiceServer(s, &grpcServer{repo: repo})
	reflection.Register(s)

	log.Printf("Bridge Repository gRPC a ouvir na porta %s...", port)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("Erro ao servir: %v", err)
	}
}
