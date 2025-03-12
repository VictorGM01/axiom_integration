import { IAxiomClient } from "./interfaces";
// Import correctly according to the documentation
const { Axiom } = require("@axiomhq/js");

interface Dataset {
  name: string;
  [key: string]: any;
}

/**
 * Client for interacting with Axiom API
 * @version 1.0.0
 */
export class AxiomClient implements IAxiomClient {
  private axiom: any;
  private dataset: string;

  /**
   * Creates a new Axiom client
   * @param {string} apiToken - Axiom API token
   * @param {string} dataset - Dataset name to use
   * @param {string} [organizationId] - Organization ID (optional, "us" or "eu")
   * @param {number} [timeout] - Request timeout in milliseconds
   */
  constructor(
    apiToken: string,
    dataset: string,
    organizationId: string = "us",
    timeout: number = 5000
  ) {
    if (!apiToken) {
      throw new Error("Axiom API token is required");
    }

    if (!dataset) {
      throw new Error("Axiom dataset name is required");
    }

    this.dataset = dataset;

    // Using the pattern from the docs: new Axiom({...})
    this.axiom = new Axiom({
      token: apiToken,
      orgId: organizationId,
      url: organizationId === "eu" ? "https://api.eu.axiom.co" : undefined,
    });
  }

  /**
   * Ingests data into Axiom
   * @param {any[]} events - Array of events to ingest
   * @returns {Promise<{ingested: number, failed: number, failures: any[]}>} Result of the ingestion
   */
  async ingestEvents(events: any[]): Promise<{
    ingested: number;
    failed: number;
    failures: any[];
  }> {
    try {
      // According to doc, ingest doesn't return a structured result with ingested/failed counts
      // Instead, it will throw an error if it fails
      await this.axiom.ingest(this.dataset, events);

      console.log("Ingest successful for events:", events.length);

      // Since ingest() doesn't return a structured result, we return a success indicator
      return {
        ingested: events.length, // Assume all events were ingested
        failed: 0,
        failures: [],
      };
    } catch (error: any) {
      console.error("Error ingesting events to Axiom:", error);

      // In case of error, return a failure indicator
      return {
        ingested: 0,
        failed: events.length,
        failures: [{ error: error.message || "Unknown error" }],
      };
    }
  }

  /**
   * Queries data from Axiom using APL (Axiom Processing Language)
   * @param {string} aplQuery - APL query to execute
   * @param {string} startTime - Start time for the query (ISO format)
   * @param {string} endTime - End time for the query (ISO format)
   * @param {string} [continuationToken] - Token for pagination
   * @returns {Promise<any>} Query results
   */
  async queryWithAPL(
    aplQuery: string,
    startTime: string,
    endTime: string,
    continuationToken?: string
  ): Promise<any> {
    try {
      // Using the query method directly as in the docs
      const result = await this.axiom.query(aplQuery, {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        continuationToken,
      });

      return result;
    } catch (error) {
      console.error("Error querying Axiom with APL:", error);
      throw error;
    }
  }

  /**
   * Retrieves health status of the Axiom service
   * @returns {Promise<boolean>} True if the service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Try to get datasets as a simple health check
      const datasets = await this.axiom.datasets.list();

      if (!datasets || !Array.isArray(datasets)) {
        console.warn("Failed to retrieve datasets list from Axiom.");
        return false;
      }

      // Check if our dataset exists
      const datasetExists = datasets.some(
        (ds: Dataset) => ds.name === this.dataset
      );

      if (!datasetExists) {
        console.warn(`Dataset "${this.dataset}" not found in Axiom account.`);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error checking Axiom health status:", error);
      return false;
    }
  }
}
