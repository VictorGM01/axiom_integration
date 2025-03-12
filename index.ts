import "dotenv/config";
import { build } from "./app";

const VERSION = "1.0.0";

async function start() {
  try {
    const app = build();

    // Log environment information
    app.log.info(`Starting Cancellation Service with Axiom logging`);
    app.log.info(`Version: ${VERSION}`);
    app.log.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    app.log.info(
      `Axiom Dataset: ${process.env.AXIOM_DATASET_NAME || "cancellation-logs"}`
    );

    // Get the port and host from environment or use defaults
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const host = process.env.HOST || "0.0.0.0";

    // Start the server
    await app.listen({ port, host });
    app.log.info(`Server is running at http://${host}:${port}`);
    app.log.info(
      `API Documentation available at http://${host}:${port}/reference`
    );

    // Register graceful shutdown
    const shutdown = async () => {
      app.log.info("Shutting down server...");
      await app.close();
      app.log.info("Server closed");
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

// Run the server
start();
