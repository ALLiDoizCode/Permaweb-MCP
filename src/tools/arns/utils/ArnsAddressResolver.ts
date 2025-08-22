import type { ResolutionResult } from "../../token/utils/TokenResolver.js";

import { ArnsClientManager } from "./ArnsClientManager.js";
import { isValidArnsName } from "./ArnsNameValidation.js";

/**
 * ArNS Address Resolution Utilities
 * Provides utilities for resolving ArNS names to Arweave transaction IDs
 */
export class ArnsAddressResolver {
  private static clientManager = ArnsClientManager.getInstance();

  /**
   * Check if a string looks like an ArNS name
   * @param input - String to check
   * @returns boolean indicating if input looks like an ArNS name
   */
  static isArnsName(input: string): boolean {
    return input.endsWith(".ar") && isValidArnsName(input);
  }

  /**
   * Resolve ArNS name to Arweave transaction ID
   * @param arnsName - ArNS name to resolve (e.g., "example.ar" or "sub.example.ar")
   * @param network - Optional network override
   * @returns ResolutionResult with resolved transaction ID
   */
  static async resolveArnsToAddress(
    arnsName: string,
    network?: "mainnet" | "testnet",
  ): Promise<ResolutionResult<string>> {
    try {
      // Validate ArNS name format
      if (!isValidArnsName(arnsName)) {
        return {
          requiresVerification: false,
          resolved: false,
          verificationMessage: `Invalid ArNS name format: "${arnsName}". Must be a valid ArNS name (e.g., example.ar or sub.example.ar)`,
        };
      }

      // Initialize client with specified network or from environment
      if (network) {
        await this.clientManager.switchNetwork(network);
      } else {
        await this.clientManager.initializeFromEnvironment();
      }

      const arnsClient = this.clientManager.getClient();

      if (!arnsClient) {
        throw new Error("ArNS client not initialized");
      }

      // Remove .ar suffix for resolution
      const nameToResolve = arnsName.replace(/\.ar$/i, "");

      // Resolve ArNS name to transaction ID
      const resolvedRecord = await arnsClient.resolveArNSName({
        name: nameToResolve,
      });

      if (!resolvedRecord) {
        return {
          requiresVerification: false,
          resolved: false,
          verificationMessage: `ArNS name "${arnsName}" could not be resolved. The name may not exist or the network may be unavailable. Please verify the name exists and try again.`,
        };
      }

      // Extract transaction ID from the resolved record
      const transactionId =
        typeof resolvedRecord === "string"
          ? resolvedRecord
          : resolvedRecord.txId;

      if (!transactionId) {
        return {
          requiresVerification: false,
          resolved: false,
          verificationMessage: `ArNS name "${arnsName}" resolved but no transaction ID found. The record may be invalid.`,
        };
      }

      // Return successful resolution with verification
      return {
        requiresVerification: true,
        resolved: true,
        value: transactionId,
        verificationMessage: `ArNS name "${arnsName}" resolved to ${transactionId} on ${this.clientManager.getCurrentNetwork()}. Continue?`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Handle specific error scenarios
      if (errorMessage.includes("not initialized")) {
        return {
          requiresVerification: false,
          resolved: false,
          verificationMessage: `Error resolving ArNS name "${arnsName}": ${errorMessage}. Please try using the direct address instead.`,
        };
      }

      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("network")
      ) {
        return {
          requiresVerification: false,
          resolved: false,
          verificationMessage: `Network timeout resolving ArNS name "${arnsName}". Please check your internet connection and try again.`,
        };
      }

      if (
        errorMessage.includes("not found") ||
        errorMessage.includes("does not exist")
      ) {
        return {
          requiresVerification: false,
          resolved: false,
          verificationMessage: `ArNS name "${arnsName}" does not exist. Please verify the name spelling and try again.`,
        };
      }

      return {
        requiresVerification: false,
        resolved: false,
        verificationMessage: `Error resolving ArNS name "${arnsName}": ${errorMessage}. Please try using the direct address instead.`,
      };
    }
  }
}
