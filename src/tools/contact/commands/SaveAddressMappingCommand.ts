import { z } from "zod";

import { event } from "../../../relay.js";
import { MEMORY_KINDS } from "../../../services/AIMemoryService.js";
import {
  CommonSchemas,
  ToolCommand,
  ToolContext,
  ToolMetadata,
} from "../../core/index.js";

interface SaveAddressMappingArgs {
  address: string;
  name: string;
}

export class SaveAddressMappingCommand extends ToolCommand<
  SaveAddressMappingArgs,
  string
> {
  protected metadata: ToolMetadata = {
    description: "Save a contact name to address mapping for future use",
    name: "saveAddressMapping",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Save Address Mapping",
  };

  protected parametersSchema = z.object({
    address: CommonSchemas.address.describe("Wallet address"),
    name: z.string().describe("Contact name"),
  });

  constructor(private context: ToolContext) {
    super();
  }

  async execute(args: SaveAddressMappingArgs): Promise<string> {
    try {
      // Use dedicated contact mapping kind for better filtering
      const tags = [
        { name: "Kind", value: MEMORY_KINDS.CONTACT_MAPPING },
        {
          name: "Content",
          value: `Contact mapping: name: ${args.name}, address: ${args.address}`,
        },
        { name: "p", value: this.context.publicKey },
        { name: "contact_name", value: args.name },
        { name: "contact_address", value: args.address },
        { name: "domain", value: "address-book" },
      ];

      const result = await event(
        this.context.keyPair,
        this.context.hubId,
        tags,
      );

      return JSON.stringify({
        mapping: {
          address: args.address,
          name: args.name,
        },
        message: `Contact mapping saved: ${args.name} -> ${args.address}`,
        success: true,
        tags: result,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to save contact mapping: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      });
    }
  }
}
