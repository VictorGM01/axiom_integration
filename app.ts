import Fastify, { FastifyInstance } from "fastify";
import cancelationController from "./cancelation.controller";
import fastifyAutoload from "@fastify/autoload";
import path from "path";
import fs from "fs";

/**
 * Build and configure the Fastify application with Axiom integration
 * @returns {FastifyInstance} The configured Fastify instance
 */
export function build(): FastifyInstance {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            }
          : undefined,
    },
  });

  // Register cancellation controller with Axiom integration
  fastify.register(cancelationController);

  // Register auto-loading of plugins (if any) - only if the directory exists
  const pluginsDir = path.join(__dirname, "plugins");
  if (fs.existsSync(pluginsDir)) {
    fastify.register(fastifyAutoload, {
      dir: pluginsDir,
      options: { prefix: "api" },
    });
  }

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(`Error occurred: ${error.message}`);

    // Return appropriate error response
    reply.status(error.statusCode || 500).send({
      error: error.name || "Internal Server Error",
      message: error.message || "An unknown error occurred",
      statusCode: error.statusCode || 500,
    });
  });

  return fastify;
}
