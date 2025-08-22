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
  private arnsClient: any;
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
  public getClient(): any {
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
   * @param signer - Optional signer for write operations (required for buyRecord, transferRecord, etc.)
   */
  public async initializeClient(
    network: "mainnet" | "testnet" = "mainnet",
    signer?: any,
  ): Promise<void> {
    try {
      // Validate network parameter
      if (!["mainnet", "testnet"].includes(network)) {
        throw new Error(
          `Invalid network: ${network}. Must be 'mainnet' or 'testnet'`,
        );
      }

      if (network === "testnet") {
        this.arnsClient = signer ? ARIO.testnet({ signer }) : ARIO.testnet();
      } else {
        this.arnsClient = signer ? ARIO.mainnet({ signer }) : ARIO.mainnet();
      }

      this.currentNetwork = network;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        `Failed to initialize ArNS client for ${network}: ${errorMessage}`,
      );
    }
  }

  /**
   * Initialize client using environment configuration
   * Uses ARNS_NETWORK environment variable to determine network
   * @param signer - Optional signer for write operations
   */
  public async initializeFromEnvironment(signer?: any): Promise<void> {
    const network = this.getNetworkFromEnvironment();
    await this.initializeClient(network, signer);
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
   * @param signer - Optional signer for write operations
   */
  public async switchNetwork(
    network: "mainnet" | "testnet",
    signer?: any,
  ): Promise<void> {
    if (this.currentNetwork !== network) {
      await this.initializeClient(network, signer);
    }
  }

  /**
   * Get network configuration from environment variable
   * Validates and defaults to mainnet if invalid or not specified
   */
  private getNetworkFromEnvironment(): "mainnet" | "testnet" {
    const envNetwork = process.env.ARNS_NETWORK?.toLowerCase();

    if (envNetwork === "testnet") {
      return "testnet";
    }

    // Default to mainnet for invalid, missing, or mainnet values
    return "mainnet";
  }
}
