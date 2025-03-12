import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration for the Axiom integration
 * @version 1.0.0
 */
export interface AxiomConfig {
  /** Axiom API token */
  apiToken: string;

  /** Axiom dataset name for cancellation logs */
  datasetName: string;

  /** Axiom region (us or eu) */
  region: string;

  /** Request timeout in milliseconds */
  timeout: number;

  /** Health check interval in milliseconds */
  healthCheckInterval: number;
}

/**
 * Default configuration values
 */
const defaultConfig: AxiomConfig = {
  apiToken: "xaat-f62b209d-238d-4ee5-a209-e2df4712ef25",
  datasetName: "inteli",
  region: "us",
  timeout: parseInt("5000", 10),
  healthCheckInterval: parseInt("300000", 10), // 5 minutes
};

/**
 * Validates the Axiom configuration
 * @param {AxiomConfig} config - Configuration to validate
 * @throws {Error} If any required configuration is missing
 */
export function validateConfig(config: AxiomConfig): void {
  if (!config.apiToken) {
    throw new Error(
      "Axiom API token is required. Set AXIOM_API_TOKEN environment variable."
    );
  }

  if (!config.datasetName) {
    throw new Error(
      "Axiom dataset name is required. Set AXIOM_DATASET_NAME environment variable."
    );
  }

  if (config.region !== "us" && config.region !== "eu") {
    throw new Error(
      'Axiom region must be "us" or "eu". Set AXIOM_REGION environment variable.'
    );
  }
}

/**
 * Gets the Axiom configuration
 * @param {Partial<AxiomConfig>} overrides - Optional configuration overrides
 * @returns {AxiomConfig} The validated configuration
 */
export function getAxiomConfig(
  overrides: Partial<AxiomConfig> = {}
): AxiomConfig {
  const config = {
    ...defaultConfig,
    ...overrides,
  };

  validateConfig(config);
  return config;
}
