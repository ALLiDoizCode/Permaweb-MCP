import { connect, createDataItemSigner } from "@permaweb/aoconnect";
import { JWKInterface } from "arweave/node/lib/wallet.js";

import {
  AOS_MODULE,
  CU_URL,
  GATEWAY_URL,
  MU_URL,
  SCHEDULER,
} from "./constants.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const { dryrun, message, result, spawn } = connect({
  CU_URL: CU_URL(),
  GATEWAY_URL: GATEWAY_URL(),
  MODE: "legacy",
  MU_URL: MU_URL(),
});

export async function send(
  signer: JWKInterface,
  processId: string,
  tags: { name: string; value: string }[],
  data: null | string,
) {
  const _message = {
    data: "",
    process: processId,
    scheduler: SCHEDULER(),
    signer: createDataItemSigner(signer),
    tags: tags,
  };
  if (data) _message.data = data;
  const messageId = await message(_message);
  return await readMessage(messageId, processId);
}

export const read = async (
  processId: string,
  tags: { name: string; value: string }[],
) => {
  const result = await dryrun({
    CU_URL: CU_URL(),
    GATEWAY_URL: GATEWAY_URL(),
    MU_URL: MU_URL(),
    process: processId,
    scheduler: SCHEDULER(),
    tags: tags,
  });

  if (result.Messages) {
    const message = result.Messages.pop();
    return message;
  }
};

// Helper function to ensure wallet is in correct format for AO Connect
function sanitizeJWKForAO(jwk: JWKInterface): JWKInterface {
  // Create a clean JWK with only the required properties for AO Connect
  return {
    d: jwk.d,
    dp: jwk.dp,
    dq: jwk.dq,
    e: jwk.e,
    kty: jwk.kty,
    n: jwk.n,
    p: jwk.p,
    q: jwk.q,
    qi: jwk.qi,
  };
}

export const createProcess = async (signer: JWKInterface) => {
  try {
    // Validate the signer before using it
    if (!signer || typeof signer !== "object") {
      throw new Error(
        "Invalid signer: signer must be a valid JWKInterface object",
      );
    }

    // Check for required JWK properties
    const requiredProps = ["kty", "n", "e"];
    for (const prop of requiredProps) {
      if (!(prop in signer)) {
        throw new Error(`Invalid signer: missing required property '${prop}'`);
      }
    }

    // Sanitize the JWK for AO Connect compatibility
    const cleanJWK = sanitizeJWKForAO(signer);

    const dataItemSigner = createDataItemSigner(cleanJWK);
    const processId = await spawn({
      module: AOS_MODULE(),
      scheduler: SCHEDULER(),
      signer: dataItemSigner,
    });
    await sleep(3000);
    return processId;
  } catch (error) {
    throw new Error(
      `Process creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export interface TokenDeploymentConfig {
  denomination?: number;
  description?: string;
  logo?: string;
  name: string;
  ticker: string;
  totalSupply?: string;
}

/*export const createTokenProcess = async (
  signer: JWKInterface,
  config: TokenDeploymentConfig,
) => {
  const tags = [
    { name: "Name", value: config.name },
    { name: "Ticker", value: config.ticker },
    { name: "Denomination", value: (config.denomination || 12).toString() },
  ];

  if (config.totalSupply) {
    tags.push({ name: "Total-Supply", value: config.totalSupply });
  }

  if (config.logo) {
    tags.push({ name: "Logo", value: config.logo });
  }

  if (config.description) {
    tags.push({ name: "Description", value: config.description });
  }

  const processId = await spawn({
    module: AOS_MODULE(),
    scheduler: SCHEDULER(),
    signer: createDataItemSigner(signer),
    tags: tags,
  });

  await sleep(3000);
  return processId;
};*/

const readMessage = async (messageId: string, processId: string) => {
  const resultData = await result({
    message: messageId,
    process: processId,
  });

  const { Error, Messages, Output } = resultData;
  if (Error !== undefined) {
    throw Error;
  }

  // Return the actual output from the process
  if (Output && Output.data) {
    try {
      // Try to parse as JSON first, in case it's a structured response
      const parsed = JSON.parse(Output.data);
      // If it has a result field, return that (for eval responses)
      if (parsed.result !== undefined) {
        return parsed.result;
      }
      // Otherwise return the parsed object
      return parsed;
    } catch {
      // If not JSON, return the raw data
      return Output.data;
    }
  }

  // If no output data, check for messages
  if (Messages && Messages.length > 0) {
    const lastMessage = Messages[Messages.length - 1];
    return lastMessage.Data || lastMessage;
  }

  return null;
};
