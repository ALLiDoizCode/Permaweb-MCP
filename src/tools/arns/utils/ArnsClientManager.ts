import { ARIO } from "@ar.io/sdk/node";

/**
 * ArNS Client Manager - Singleton pattern for managing ARIO client instances
 * Handles network switching, client caching, and connection management
 *
 * Environment Variables:
 * - ARNS_NETWORK: Network selection (mainnet | testnet) - defaults to mainnet
 */
export class ArnsClientManager {
  private static instance: ArnsClientManager;
  private arnsClient: ARIO | undefined;
  private currentNetwork: "mainnet" | "testnet" = "mainnet";

  private constructor() {}

  /**
   * Get singleton instance of ArnsClientManager
   */
  public static getInstance(): ArnsClientManager {
    if (!ArnsClientManager.instance) {
      ArnsClientManager.instance = new ArnsClientManager();
    }
    return ArnsClientManager.instance;
  }

  /**
   * Get current ARIO client instance
   */
  public getClient(): ARIO | undefined {
    return this.arnsClient;
  }

  /**
   * Get current network configuration
   */
  public getCurrentNetwork(): "mainnet" | "testnet" {
    return this.currentNetwork;
  }

  /**
   * Initialize ARIO client for specified network
   * @param network - Network to initialize (mainnet | testnet)
   */
  public async initializeClient(
    network: "mainnet" | "testnet" = "mainnet",
  ): Promise<void> {
    try {
      console.log(`Initializing ArNS client for ${network}...`);

      // Validate network parameter
      if (!["mainnet", "testnet"].includes(network)) {
        throw new Error(
          `Invalid network: ${network}. Must be 'mainnet' or 'testnet'`,
        );
      }

      if (network === "testnet") {
        this.arnsClient = ARIO.testnet();
        console.log("ArNS client initialized for testnet using ARIO.testnet()");
      } else {
        this.arnsClient = ARIO.mainnet();
        console.log("ArNS client initialized for mainnet using ARIO.mainnet()");
      }

      this.currentNetwork = network;
      console.log(`ArNS client setup complete - active network: ${network}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `ArNS client initialization failed for ${network}: ${errorMessage}`,
      );
      throw new Error(
        `Failed to initialize ArNS client for ${network}: ${errorMessage}`,
      );
    }
  }

  /**
   * Initialize client using environment configuration
   * Uses ARNS_NETWORK environment variable to determine network
   */
  public async initializeFromEnvironment(): Promise<void> {
    const network = this.getNetworkFromEnvironment();
    await this.initializeClient(network);
  }

  /**
   * Check if client is initialized
   */
  public isInitialized(): boolean {
    return this.arnsClient !== undefined;
  }

  /**
   * Reset client state - FOR TESTING ONLY
   * @private
   */
  public resetForTesting(): void {
    this.arnsClient = undefined;
    this.currentNetwork = "mainnet";
  }

  /**
   * Switch to different network if not already on target network
   * @param network - Target network (mainnet | testnet)
   */
  public async switchNetwork(network: "mainnet" | "testnet"): Promise<void> {
    if (this.currentNetwork !== network) {
      await this.initializeClient(network);
    }
  }

  /**
   * Get network configuration from environment variable
   * Validates and defaults to mainnet if invalid or not specified
   */
  private getNetworkFromEnvironment(): "mainnet" | "testnet" {
    const envNetwork = process.env.ARNS_NETWORK?.toLowerCase();

    if (envNetwork === "testnet") {
      console.log(
        "ArNS network configured via ARNS_NETWORK environment variable: testnet",
      );
      return "testnet";
    }

    if (envNetwork && envNetwork !== "mainnet") {
      console.warn(
        `Invalid ARNS_NETWORK value: ${envNetwork}. Defaulting to mainnet`,
      );
    } else if (envNetwork === "mainnet") {
      console.log(
        "ArNS network configured via ARNS_NETWORK environment variable: mainnet",
      );
    } else {
      console.log("ARNS_NETWORK not specified - defaulting to mainnet");
    }

    return "mainnet";
  }
}
