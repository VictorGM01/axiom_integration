import { AxiomClient } from "./client";
import { CancellationLogService } from "./cancellation-log.service";
import { getAxiomConfig } from "./config";
import {
  AxiomHealthCheck,
  HealthStatus,
  HealthCheckEvent,
} from "./health-check";
import {
  IAxiomClient,
  ICancellationLogService,
  CancellationLog,
  CancellationStats,
} from "./interfaces";

// Export types and interfaces
export type {
  IAxiomClient,
  ICancellationLogService,
  CancellationLog,
  CancellationStats,
};

// Export classes and enums
export {
  AxiomClient,
  CancellationLogService,
  getAxiomConfig,
  AxiomHealthCheck,
  HealthStatus,
  HealthCheckEvent,
};

/**
 * Creates a preconfigured Axiom client and cancellation log service
 * @param {boolean} startHealthCheck - Whether to start the health check
 * @returns {Object} The Axiom client, cancellation log service, and health check
 */
export function createAxiomServices(startHealthCheck: boolean = true) {
  // Get configuration from environment variables
  const config = getAxiomConfig();

  // Create the Axiom client
  const axiomClient = new AxiomClient(
    config.apiToken,
    config.datasetName,
    config.region,
    config.timeout
  );

  // Create the cancellation log service
  const cancellationLogService = new CancellationLogService(axiomClient);

  // Create the health check
  const healthCheck = new AxiomHealthCheck(
    axiomClient,
    config.healthCheckInterval
  );

  // Start health check if requested
  if (startHealthCheck) {
    healthCheck.start();
  }

  return {
    axiomClient,
    cancellationLogService,
    healthCheck,
  };
}
