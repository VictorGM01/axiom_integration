import {
  IAxiomClient,
  ICancellationLogService,
  CancellationLog,
  CancellationStats,
} from "./interfaces";

/**
 * Service for logging and retrieving cancellation data using Axiom
 * @version 1.0.0
 */
export class CancellationLogService implements ICancellationLogService {
  private readonly datasetName: string;

  /**
   * @param {IAxiomClient} axiomClient - The Axiom client to use for API calls
   */
  constructor(private readonly axiomClient: IAxiomClient) {
    if (!axiomClient) {
      throw new Error("Axiom client is required");
    }
    // Get the dataset name from the client
    this.datasetName = (axiomClient as any).dataset || 'inteli';
    console.log('Using dataset:', this.datasetName);
  }

  /**
   * Logs a cancellation attempt to Axiom
   * @param {CancellationLog} log - The cancellation log data
   * @returns {Promise<boolean>} Whether the log was successful
   */
  async logCancellationAttempt(log: CancellationLog): Promise<boolean> {
    try {
      // Ensure timestamp is set
      const logWithTimestamp = {
        ...log,
        timestamp: log.timestamp || new Date().toISOString(),
        _time: new Date().toISOString(), // Add _time field which Axiom might use for time indexing
      };

      console.log('Logging to Axiom:', logWithTimestamp);
      
      // Send to Axiom
      const result = await this.axiomClient.ingestEvents([logWithTimestamp]);
      console.log('Ingest result:', result);

      return result.ingested > 0;
    } catch (error) {
      console.error(
        `[CancellationLogService] Failed to log cancellation attempt: ${error}`
      );
      return false;
    }
  }

  /**
   * Retrieves logs of successful cancellations
   * @param {string} startTime - Start time for the query (ISO format)
   * @param {string} endTime - End time for the query (ISO format)
   * @param {number} [limit=100] - Maximum number of logs to retrieve
   * @returns {Promise<CancellationLog[]>} List of cancellation logs
   */
  async getSuccessfulCancellations(
    startTime: string,
    endTime: string,
    limit: number = 100
  ): Promise<CancellationLog[]> {
    // Simplify the query to just get all records and filter client-side
    const query = `['${this.datasetName}'] | limit ${limit}`;
    console.log('Running query for successful cancellations:', query);
    
    const logs = await this.queryCancellationLogs(query, startTime, endTime);
    // Filter successful logs client-side
    return logs.filter(log => log.success === true);
  }

  /**
   * Retrieves logs of failed cancellations
   * @param {string} startTime - Start time for the query (ISO format)
   * @param {string} endTime - End time for the query (ISO format)
   * @param {number} [limit=100] - Maximum number of logs to retrieve
   * @returns {Promise<CancellationLog[]>} List of cancellation logs
   */
  async getFailedCancellations(
    startTime: string,
    endTime: string,
    limit: number = 100
  ): Promise<CancellationLog[]> {
    // Simplify the query to just get all records and filter client-side
    const query = `['${this.datasetName}'] | limit ${limit}`;
    console.log('Running query for failed cancellations:', query);
    
    const logs = await this.queryCancellationLogs(query, startTime, endTime);
    // Filter failed logs client-side
    return logs.filter(log => log.success === false);
  }

  /**
   * Retrieves statistics for cancellations
   * @param {string} startTime - Start time for the query (ISO format)
   * @param {string} endTime - End time for the query (ISO format)
   * @returns {Promise<CancellationStats>} Cancellation statistics
   */
  async getCancellationStats(
    startTime: string,
    endTime: string
  ): Promise<CancellationStats> {
    try {
      // First, get all logs
      const query = `['${this.datasetName}'] | limit 1000`;
      console.log('Running stats query:', query);
      
      const logs = await this.queryCancellationLogs(query, startTime, endTime);
      
      // Calculate statistics from the logs
      const successfulLogs = logs.filter(log => log.success === true);
      const failedLogs = logs.filter(log => log.success === false);
      
      const totalAttempts = logs.length;
      const successfulCancellations = successfulLogs.length;
      const failedCancellations = failedLogs.length;
      
      const totalTaxCollected = successfulLogs.reduce((sum, log) => sum + (log.tax || 0), 0);
      const totalOrderAmount = logs.reduce((sum, log) => sum + (log.totalAmount || 0), 0);
      
      const successRate = totalAttempts > 0 ? successfulCancellations / totalAttempts : 0;
      const averageTax = successfulCancellations > 0 ? totalTaxCollected / successfulCancellations : 0;
      const averageOrderAmount = totalAttempts > 0 ? totalOrderAmount / totalAttempts : 0;
      
      // Find the most common failure reason
      const failureReasons = failedLogs.map(log => log.failureReason || 'Unknown');
      const failureReasonCounts = failureReasons.reduce((counts, reason) => {
        counts[reason] = (counts[reason] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      let topFailureReason: string | undefined;
      let maxCount = 0;
      
      Object.entries(failureReasonCounts).forEach(([reason, count]) => {
        if (count > maxCount) {
          topFailureReason = reason;
          maxCount = count;
        }
      });
      
      return {
        totalAttempts,
        successfulCancellations,
        failedCancellations,
        successRate,
        averageTax,
        totalTaxCollected,
        averageOrderAmount,
        topFailureReason
      };
    } catch (error) {
      console.error(
        `[CancellationLogService] Failed to get cancellation stats: ${error}`
      );
      throw new Error(`Failed to get cancellation statistics: ${error}`);
    }
  }

  /**
   * Helper method to query cancellation logs with pagination support
   * @private
   */
  private async queryCancellationLogs(
    query: string,
    startTime: string,
    endTime: string,
    limit?: number
  ): Promise<CancellationLog[]> {
    try {
      // Don't add limit again if it's already in the query
      const fullQuery = limit && !query.includes('limit') 
        ? `${query} | limit ${limit}` 
        : query;
        
      console.log(`Executing query: ${fullQuery} with time range ${startTime} to ${endTime}`);

      let allResults: CancellationLog[] = [];
      let continuationToken: string | undefined;

      // Handle pagination using continuationToken
      do {
        const result = await this.axiomClient.queryWithAPL(
          fullQuery,
          startTime,
          endTime,
          continuationToken
        );
        
        console.log('Query result:', JSON.stringify(result, null, 2));

        // Extract logs from the result
        const logs =
          result.matches?.map((match: any) => match.data as CancellationLog) ||
          [];
        allResults = [...allResults, ...logs];

        // Get continuation token for next page
        continuationToken = result.status?.continuationToken;

        // Break if we've reached the specified limit
        if (limit && allResults.length >= limit) {
          allResults = allResults.slice(0, limit);
          break;
        }
      } while (continuationToken);

      console.log(`Found ${allResults.length} logs`);
      return allResults;
    } catch (error) {
      console.error(`[CancellationLogService] Query error: ${error}`);
      throw new Error(`Failed to query cancellation logs: ${error}`);
    }
  }
}
