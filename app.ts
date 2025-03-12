import fastify, { FastifyInstance } from "fastify";
import cancelationController from "./cancelation.controller";

export async function build(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false, // Disable logging during tests
  });

  // Register the controller
  await app.register(cancelationController);

  return app;
}