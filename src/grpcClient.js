// This file sets up the gRPC client to communicate with our Python AI service.

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

// Define the path to the .proto file
const PROTO_PATH = path.join(__dirname, "../proto/rag.proto");

// Load the protocol buffer
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

// Get the package definition
const ragProto = grpc.loadPackageDefinition(packageDefinition).rag;

// Create and export the gRPC client stub
// The address 'oracyn_ai_service:50051' matches the service name and port
// defined in our docker-compose.yml file.
const client = new ragProto.RagService(
  "oracyn_ai_service:50051",
  grpc.credentials.createInsecure() // We use insecure credentials for internal Docker communication
);

console.log("gRPC client is attempting to connect to the AI service...");

module.exports = client;
