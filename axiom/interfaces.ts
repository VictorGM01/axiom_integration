/**
 * Interface for the Axiom client
 * @version 1.0.0
 */
export interface IAxiomClient {
  /**
   * Ingests data into Axiom
   * @param {any[]} events - Array of events to ingest
   * @returns {Promise<{ingested: number, failed: number, failures: any[]}>} Result of the ingestion
   */
  ingestEvents(events: any[]): Promise<{
    ingested: number;
    failed: number;
    failures: any[];
  }>;

  /**
   * Queries data from Axiom using APL (Axiom Processing Language)
   * @param {string} aplQuery - APL query to execute
   * @param {string} startTime - Start time for the query (ISO format)
   * @param {string} endTime - End time for the query (ISO format)
   * @param {string} [continuationToken] - Token for pagination
   * @returns {Promise<any>} Query results
   */
  queryWithAPL(
    aplQuery: string,
    startTime: string,
    endTime: string,
    continuationToken?: string
  ): Promise<any>;

  /**
   * Retrieves health status of the Axiom service
   * @returns {Promise<boolean>} True if the service is healthy
   */
  checkHealth(): Promise<boolean>;
}

/**
 * Interface for the cancellation log service
 * @version 1.0.0
 */
export interface ICancellationLogService {
  /**
   * Logs a cancellation attempt
   * @param {CancellationLog} log - The cancellation log data
   * @returns {Promise<boolean>} Whether the log was successful
   */
  logCancellationAttempt(log: CancellationLog): Promise<boolean>;

  /**
   * Retrieves logs of successful cancellations
   * @param {string} startTime - Start time for the query (ISO format)
   * @param {string} endTime - End time for the query (ISO format)
   * @param {number} [limit=100] - Maximum number of logs to retrieve
   * @returns {Promise<CancellationLog[]>} List of cancellation logs
   */
  getSuccessfulCancellations(
    startTime: string,
    endTime: string,
    limit?: number
  ): Promise<CancellationLog[]>;

  /**
   * Retrieves logs of failed cancellations
   * @param {string} startTime - Start time for the query (ISO format)
   * @param {string} endTime - End time for the query (ISO format)
   * @param {number} [limit=100] - Maximum number of logs to retrieve
   * @returns {Promise<CancellationLog[]>} List of cancellation logs
   */
  getFailedCancellations(
    startTime: string,
    endTime: string,
    limit?: number
  ): Promise<CancellationLog[]>;

  /**
   * Retrieves statistics for cancellations
   * @param {string} startTime - Start time for the query (ISO format)
   * @param {string} endTime - End time for the query (ISO format)
   * @returns {Promise<CancellationStats>} Cancellation statistics
   */
  getCancellationStats(
    startTime: string,
    endTime: string
  ): Promise<CancellationStats>;
}

/**
 * Represents a cancellation log record
 * @version 1.0.0
 */
export interface CancellationLog {
  /** Order ID for the cancellation attempt */
  orderId: string;

  /** Total amount of the order */
  totalAmount: number;

  /** Status of the order when cancellation was attempted */
  orderStatus: string;

  /** Result of the cancellation attempt (true for success, false for failure) */
  success: boolean;

  /** Message from the cancellation operation */
  message: string;

  /** Cancellation tax applied (only for successful cancellations) */
  tax?: number;

  /** Timestamp of the cancellation attempt */
  timestamp: string;

  /** Reason for cancellation if it failed */
  failureReason?: string;

  /** IP address of the client making the request */
  clientIp?: string;

  /** User agent of the client making the request */
  userAgent?: string;
}

/**
 * Represents statistics for cancellations
 * @version 1.0.0
 */
export interface CancellationStats {
  /** Total number of cancellation attempts */
  totalAttempts: number;

  /** Number of successful cancellations */
  successfulCancellations: number;

  /** Number of failed cancellations */
  failedCancellations: number;

  /** Success rate (0-1) */
  successRate: number;

  /** Average cancellation tax for successful cancellations */
  averageTax: number;

  /** Total tax collected from cancellations */
  totalTaxCollected: number;

  /** Average order amount for all cancellation attempts */
  averageOrderAmount: number;

  /** Most common reason for cancellation failure */
  topFailureReason?: string;
}
