package com.tp3.xmlservice;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.54.0)",
    comments = "Source: xmlservice.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class XMLServiceGrpc {

  private XMLServiceGrpc() {}

  public static final String SERVICE_NAME = "xmlservice.XMLService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<com.tp3.xmlservice.QueryRequest,
      com.tp3.xmlservice.QueryResponse> getQueryXMLMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "QueryXML",
      requestType = com.tp3.xmlservice.QueryRequest.class,
      responseType = com.tp3.xmlservice.QueryResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.tp3.xmlservice.QueryRequest,
      com.tp3.xmlservice.QueryResponse> getQueryXMLMethod() {
    io.grpc.MethodDescriptor<com.tp3.xmlservice.QueryRequest, com.tp3.xmlservice.QueryResponse> getQueryXMLMethod;
    if ((getQueryXMLMethod = XMLServiceGrpc.getQueryXMLMethod) == null) {
      synchronized (XMLServiceGrpc.class) {
        if ((getQueryXMLMethod = XMLServiceGrpc.getQueryXMLMethod) == null) {
          XMLServiceGrpc.getQueryXMLMethod = getQueryXMLMethod =
              io.grpc.MethodDescriptor.<com.tp3.xmlservice.QueryRequest, com.tp3.xmlservice.QueryResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "QueryXML"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.tp3.xmlservice.QueryRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.tp3.xmlservice.QueryResponse.getDefaultInstance()))
              .setSchemaDescriptor(new XMLServiceMethodDescriptorSupplier("QueryXML"))
              .build();
        }
      }
    }
    return getQueryXMLMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static XMLServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<XMLServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<XMLServiceStub>() {
        @java.lang.Override
        public XMLServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new XMLServiceStub(channel, callOptions);
        }
      };
    return XMLServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static XMLServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<XMLServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<XMLServiceBlockingStub>() {
        @java.lang.Override
        public XMLServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new XMLServiceBlockingStub(channel, callOptions);
        }
      };
    return XMLServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static XMLServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<XMLServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<XMLServiceFutureStub>() {
        @java.lang.Override
        public XMLServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new XMLServiceFutureStub(channel, callOptions);
        }
      };
    return XMLServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public interface AsyncService {

    /**
     */
    default void queryXML(com.tp3.xmlservice.QueryRequest request,
        io.grpc.stub.StreamObserver<com.tp3.xmlservice.QueryResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getQueryXMLMethod(), responseObserver);
    }
  }

  /**
   * Base class for the server implementation of the service XMLService.
   */
  public static abstract class XMLServiceImplBase
      implements io.grpc.BindableService, AsyncService {

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return XMLServiceGrpc.bindService(this);
    }
  }

  /**
   * A stub to allow clients to do asynchronous rpc calls to service XMLService.
   */
  public static final class XMLServiceStub
      extends io.grpc.stub.AbstractAsyncStub<XMLServiceStub> {
    private XMLServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected XMLServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new XMLServiceStub(channel, callOptions);
    }

    /**
     */
    public void queryXML(com.tp3.xmlservice.QueryRequest request,
        io.grpc.stub.StreamObserver<com.tp3.xmlservice.QueryResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getQueryXMLMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   * A stub to allow clients to do synchronous rpc calls to service XMLService.
   */
  public static final class XMLServiceBlockingStub
      extends io.grpc.stub.AbstractBlockingStub<XMLServiceBlockingStub> {
    private XMLServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected XMLServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new XMLServiceBlockingStub(channel, callOptions);
    }

    /**
     */
    public com.tp3.xmlservice.QueryResponse queryXML(com.tp3.xmlservice.QueryRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getQueryXMLMethod(), getCallOptions(), request);
    }
  }

  /**
   * A stub to allow clients to do ListenableFuture-style rpc calls to service XMLService.
   */
  public static final class XMLServiceFutureStub
      extends io.grpc.stub.AbstractFutureStub<XMLServiceFutureStub> {
    private XMLServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected XMLServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new XMLServiceFutureStub(channel, callOptions);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<com.tp3.xmlservice.QueryResponse> queryXML(
        com.tp3.xmlservice.QueryRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getQueryXMLMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_QUERY_XML = 0;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final AsyncService serviceImpl;
    private final int methodId;

    MethodHandlers(AsyncService serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_QUERY_XML:
          serviceImpl.queryXML((com.tp3.xmlservice.QueryRequest) request,
              (io.grpc.stub.StreamObserver<com.tp3.xmlservice.QueryResponse>) responseObserver);
          break;
        default:
          throw new AssertionError();
      }
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public io.grpc.stub.StreamObserver<Req> invoke(
        io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        default:
          throw new AssertionError();
      }
    }
  }

  public static final io.grpc.ServerServiceDefinition bindService(AsyncService service) {
    return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
        .addMethod(
          getQueryXMLMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.tp3.xmlservice.QueryRequest,
              com.tp3.xmlservice.QueryResponse>(
                service, METHODID_QUERY_XML)))
        .build();
  }

  private static abstract class XMLServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    XMLServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return com.tp3.xmlservice.XmlServiceProto.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("XMLService");
    }
  }

  private static final class XMLServiceFileDescriptorSupplier
      extends XMLServiceBaseDescriptorSupplier {
    XMLServiceFileDescriptorSupplier() {}
  }

  private static final class XMLServiceMethodDescriptorSupplier
      extends XMLServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    XMLServiceMethodDescriptorSupplier(String methodName) {
      this.methodName = methodName;
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.MethodDescriptor getMethodDescriptor() {
      return getServiceDescriptor().findMethodByName(methodName);
    }
  }

  private static volatile io.grpc.ServiceDescriptor serviceDescriptor;

  public static io.grpc.ServiceDescriptor getServiceDescriptor() {
    io.grpc.ServiceDescriptor result = serviceDescriptor;
    if (result == null) {
      synchronized (XMLServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new XMLServiceFileDescriptorSupplier())
              .addMethod(getQueryXMLMethod())
              .build();
        }
      }
    }
    return result;
  }
}
