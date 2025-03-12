import { IAxiomClient } from "./interfaces";
import EventEmitter from "events";

/**
 * Health check status
 */
export enum HealthStatus {
  HEALTHY = "healthy",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
}

/**
 * Events emitted by the health checker
 */
export enum HealthCheckEvent {
  STATUS_CHANGED = "status-changed",
  HEALTHY = "healthy",
  UNHEALTHY = "unhealthy",
}

/**
 * Class to monitor the health of the Axiom integration
 * @version 1.0.0
 */
export class AxiomHealthCheck extends EventEmitter {
  private currentStatus: HealthStatus = HealthStatus.UNKNOWN;
  private checkIntervalId: NodeJS.Timeout | null = null;

  /**
   * Creates a new Axiom health check
   * @param {IAxiomClient} axiomClient - The Axiom client to monitor
   * @param {number} interval - Check interval in milliseconds (default: 5 minutes)
   */
  constructor(
    private readonly axiomClient: IAxiomClient,
    private readonly interval: number = 5 * 60 * 1000
  ) {
    super();

    if (!axiomClient) {
      throw new Error("Axiom client is required");
    }
  }

  /**
   * Starts the health check monitoring
   * @returns {AxiomHealthCheck} This instance for chaining
   */
  start(): AxiomHealthCheck {
    if (this.checkIntervalId) {
      return this;
    }

    // Perform an immediate check
    this.check();

    // Schedule periodic checks
    this.checkIntervalId = setInterval(() => this.check(), this.interval);

    return this;
  }

  /**
   * Stops the health check monitoring
   * @returns {AxiomHealthCheck} This instance for chaining
   */
  stop(): AxiomHealthCheck {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    return this;
  }

  /**
   * Gets the current health status
   * @returns {HealthStatus} The current health status
   */
  getStatus(): HealthStatus {
    return this.currentStatus;
  }

  /**
   * Performs a health check against the Axiom API
   * @returns {Promise<HealthStatus>} The health status
   */
  async check(): Promise<HealthStatus> {
    try {
      const isHealthy = await this.axiomClient.checkHealth();
      const newStatus = isHealthy
        ? HealthStatus.HEALTHY
        : HealthStatus.UNHEALTHY;

      // If status changed, emit events
      if (newStatus !== this.currentStatus) {
        const oldStatus = this.currentStatus;
        this.currentStatus = newStatus;

        this.emit(HealthCheckEvent.STATUS_CHANGED, {
          oldStatus,
          newStatus,
          timestamp: new Date().toISOString(),
        });

        if (newStatus === HealthStatus.HEALTHY) {
          this.emit(HealthCheckEvent.HEALTHY);
        } else {
          this.emit(HealthCheckEvent.UNHEALTHY);
        }
      }

      return this.currentStatus;
    } catch (error) {
      this.currentStatus = HealthStatus.UNHEALTHY;
      this.emit(HealthCheckEvent.UNHEALTHY);
      return HealthStatus.UNHEALTHY;
    }
  }
}
