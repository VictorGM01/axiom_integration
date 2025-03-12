import fastify from "fastify";
import cancelationController from "./cancelation.controller";

const server = fastify({
  logger: true,
});

// Register the cancellation controller
server.register(cancelationController);

// Start the server
const start = async () => {
  try {
    await server.listen({
      port: 3000,
      host: "0.0.0.0", // Listen on all network interfaces
    });
    console.log("Server is running on http://localhost:3000");
    console.log(
      "API Documentation available at http://localhost:3000/reference"
    );
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();