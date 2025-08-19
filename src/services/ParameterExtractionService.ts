import { HandlerParameter } from "./DocumentationProtocolService.js";

/**
 * Service for extracting parameter information from generated Lua code.
 *
 * This service analyzes Lua handler code to identify parameter usage patterns
 * and automatically generate ADP-compliant parameter definitions.
 */
export class ParameterExtractionService {
  /**
   * Extract parameters from complete Lua code containing multiple handlers
   */
  extractParametersFromCode(luaCode: string): Map<string, HandlerParameter[]> {
    const handlerParameters = new Map<string, HandlerParameter[]>();

    // Find all handler definitions
    const handlerMatches = luaCode.matchAll(
      /Handlers\.add\(\s*['"](.*?)['"].*?hasMatchingTag\(\s*['"]Action['"],\s*['"](.*?)['"]\).*?function\([^)]*\)(.*?)end\s*\)/gs,
    );

    for (const match of handlerMatches) {
      const [, handlerName, actionValue, handlerBody] = match;
      if (handlerName && actionValue && handlerBody) {
        const parameters = this.extractParametersFromHandler(
          handlerBody,
          actionValue,
        );
        handlerParameters.set(actionValue, parameters);
      }
    }

    return handlerParameters;
  }

  /**
   * Extract parameters from a single Lua handler code block
   */
  extractParametersFromHandler(
    handlerCode: string,
    actionName: string,
  ): HandlerParameter[] {
    const parameters: HandlerParameter[] = [];
    const parameterMap = new Map<string, HandlerParameter>();

    // Extract parameter usage patterns
    const tagPatterns = this.extractTagPatterns(handlerCode);
    const dataPatterns = this.extractDataPatterns(handlerCode);
    const typeInferences = this.inferParameterTypes(handlerCode);

    // Process tag-based parameters (msg.Tags.ParamName)
    for (const tagPattern of tagPatterns) {
      // Check for type inference using both original and normalized names
      const inferredType =
        typeInferences.get(tagPattern.name) ||
        typeInferences.get(tagPattern.name.toLowerCase()) ||
        "string";

      const param: HandlerParameter = {
        description: this.generateParameterDescription(
          tagPattern.name,
          actionName,
          inferredType,
        ),
        name: tagPattern.name,
        required: tagPattern.required,
        type: inferredType,
      };

      // Add validation rules based on type
      param.validation = this.generateValidationRules(
        param.type,
        tagPattern.name,
      );

      // Add examples
      param.examples = this.generateParameterExamples(
        param.type,
        tagPattern.name,
      );

      parameterMap.set(tagPattern.name, param);
    }

    // Process data-based parameters (msg.Data usage) - only if it's not already handled as a tag fallback
    for (const dataPattern of dataPatterns) {
      if (
        !parameterMap.has("Data") &&
        !this.isDataUsedAsFallback(handlerCode)
      ) {
        const param: HandlerParameter = {
          description: this.generateParameterDescription(
            "Data",
            actionName,
            dataPattern.type,
          ),
          name: "Data",
          required: dataPattern.required,
          type: dataPattern.type,
        };

        param.validation = this.generateValidationRules(param.type, "Data");
        param.examples = this.generateParameterExamples(param.type, "Data");

        parameterMap.set("Data", param);
      }
    }

    return Array.from(parameterMap.values()).sort((a, b) => {
      // Sort required parameters first
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Determine if a parameter is required based on code analysis
   */
  private determineIfRequired(handlerCode: string, paramName: string): boolean {
    // Look for patterns where the parameter has a literal default value
    // Pattern: msg.Tags.ParamName or "defaultValue"
    const literalDefaultPattern = new RegExp(
      `msg\\.Tags\\.${paramName}\\s+or\\s+["'][^"']+["']`,
      "i",
    );
    const hasLiteralDefault = literalDefaultPattern.test(handlerCode);

    // Pattern: msg.Tags.ParamName or msg.From (fallback to sender)
    const senderFallbackPattern = new RegExp(
      `msg\\.Tags\\.${paramName}\\s+or\\s+msg\\.From`,
      "i",
    );
    const hasSenderFallback = senderFallbackPattern.test(handlerCode);

    // If there's a literal default or sender fallback, it's optional
    return !(hasLiteralDefault || hasSenderFallback);
  }

  /**
   * Extract data-based parameter patterns from Lua code
   */
  private extractDataPatterns(
    handlerCode: string,
  ): Array<{ required: boolean; type: HandlerParameter["type"] }> {
    const patterns: Array<{
      required: boolean;
      type: HandlerParameter["type"];
    }> = [];

    // Check if msg.Data is used
    if (handlerCode.includes("msg.Data")) {
      const type = this.inferDataType(handlerCode);
      const required = !handlerCode.includes("msg.Data or");
      patterns.push({ required, type });
    }

    return patterns;
  }

  /**
   * Extract tag-based parameter patterns from Lua code
   */
  private extractTagPatterns(
    handlerCode: string,
  ): Array<{ name: string; required: boolean }> {
    const patterns: Array<{ name: string; required: boolean }> = [];
    const seen = new Set<string>();

    // Pattern 1: msg.Tags.ParamName or msg.Tags.paramname
    const tagMatches = handlerCode.matchAll(
      /msg\.Tags\.([A-Za-z][A-Za-z0-9]*)/g,
    );
    for (const match of tagMatches) {
      const paramName = match[1];
      // Normalize parameter names - use uppercase version if both exist
      const normalizedName =
        paramName.charAt(0).toUpperCase() + paramName.slice(1);

      if (!seen.has(normalizedName)) {
        seen.add(normalizedName);
        patterns.push({
          name: normalizedName,
          required: this.determineIfRequired(handlerCode, paramName),
        });
      }
    }

    return patterns;
  }

  /**
   * Generate human-readable parameter description
   */
  private generateParameterDescription(
    paramName: string,
    actionName: string,
    type: HandlerParameter["type"],
  ): string {
    const nameMap: Record<string, string> = {
      A: "First operand",
      Amount: "Amount value",
      B: "Second operand",
      Data: "Message data payload",
      From: "Sender address",
      Key: "Storage key identifier",
      Move: "Game move data",
      Owner: "Owner address",
      PlayerName: "Player display name",
      ProcessId: "Target process ID",
      ProposalId: "Proposal identifier",
      Quantity: "Transfer quantity",
      Recipient: "Recipient address",
      Step: "Increment/decrement step size",
      Target: "Target address",
      Title: "Proposal title",
      Username: "User display name",
      Value: "Value to store",
      Vote: "Vote choice (yes/no)",
    };

    const baseDescription =
      nameMap[paramName] || `${paramName} parameter for ${actionName} action`;

    const typeDescriptions: Record<HandlerParameter["type"], string> = {
      address: `${baseDescription} (Arweave address)`,
      boolean: `${baseDescription} (true/false)`,
      json: `${baseDescription} (JSON object)`,
      number: `${baseDescription} (numeric value)`,
      string: baseDescription,
    };

    return typeDescriptions[type];
  }

  /**
   * Generate example values for parameters
   */
  private generateParameterExamples(
    type: HandlerParameter["type"],
    paramName: string,
  ): string[] {
    const examples: Record<string, string[]> = {
      A: ["15", "100", "42"],
      Amount: ["1000", "500", "1500000000000"],
      B: ["25", "50", "7"],
      Data: ["Hello World", "User message", "Process data"],
      Key: ["user1", "balance", "config"],
      Move: ["up", "down", "left", "right"],
      PlayerName: ["Alice", "Bob", "Player1"],
      ProposalId: ["1", "2", "42"],
      Quantity: ["100", "1000000000000"],
      Recipient: [
        "vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI",
        "1seRanklLU_1VTGkEk7P0xAwMJfA7owA1JHW5KyZKlY",
      ],
      Step: ["1", "5", "10"],
      Target: [
        "vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI",
        "1seRanklLU_1VTGkEk7P0xAwMJfA7owA1JHW5KyZKlY",
      ],
      Title: ["Increase token supply", "Protocol upgrade"],
      Username: ["alice", "bob123", "user_42"],
      Value: ["stored_value", "configuration_data"],
      Vote: ["yes", "no"],
    };

    if (examples[paramName]) {
      return examples[paramName];
    }

    // Generate type-based examples
    switch (type) {
      case "address":
        return [
          "vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI",
          "1seRanklLU_1VTGkEk7P0xAwMJfA7owA1JHW5KyZKlY",
        ];
      case "boolean":
        return ["true", "false"];
      case "json":
        return ['{"key": "value"}', '{"amount": 100}'];
      case "number":
        return ["100", "42", "1500"];
      case "string":
        return ["example_string", "user_input", "text_value"];
      default:
        return ["example_value"];
    }
  }

  /**
   * Generate validation rules based on parameter type and name
   */
  private generateValidationRules(
    type: HandlerParameter["type"],
    paramName: string,
  ): HandlerParameter["validation"] | undefined {
    switch (type) {
      case "address":
        return {
          pattern: "^[a-zA-Z0-9_-]{43}$",
        };

      case "boolean":
        return { enum: ["true", "false"] };

      case "number":
        if (["Amount", "Quantity", "Step"].includes(paramName)) {
          return { min: 0 };
        }
        break;

      case "string":
        if (paramName === "Vote") {
          return { enum: ["yes", "no"] };
        }
        break;
    }

    return undefined;
  }

  /**
   * Infer the type of msg.Data usage
   */
  private inferDataType(handlerCode: string): HandlerParameter["type"] {
    if (handlerCode.includes("tonumber(msg.Data")) {
      return "number";
    }
    if (handlerCode.includes("json.decode(msg.Data")) {
      return "json";
    }
    // Check for boolean-like usage
    if (handlerCode.match(/msg\.Data\s*[=!]=\s*["'](true|false|yes|no)["']/i)) {
      return "boolean";
    }
    return "string";
  }

  /**
   * Infer parameter types from Lua code usage
   */
  private inferParameterTypes(
    handlerCode: string,
  ): Map<string, HandlerParameter["type"]> {
    const typeMap = new Map<string, HandlerParameter["type"]>();
    const lines = handlerCode.split("\n");

    for (const line of lines) {
      // Pattern: any msg.Tags in tonumber() context -> number type
      if (line.includes("tonumber")) {
        const tagMatches = line.matchAll(/msg\.Tags\.([A-Za-z][A-Za-z0-9]*)/g);
        for (const match of tagMatches) {
          const paramName = match[1];
          const normalizedName =
            paramName.charAt(0).toUpperCase() + paramName.slice(1);
          typeMap.set(normalizedName, "number");
          typeMap.set(paramName, "number"); // Also keep original for lookup
        }
      }

      // Pattern: msg.Tags.ParamName == "true" -> boolean type
      const booleanMatches = line.matchAll(
        /msg\.Tags\.([A-Za-z][A-Za-z0-9]*)\s*[=!]=\s*["'](true|false|yes|no)["']/gi,
      );
      for (const match of booleanMatches) {
        const paramName = match[1];
        const normalizedName =
          paramName.charAt(0).toUpperCase() + paramName.slice(1);
        typeMap.set(normalizedName, "boolean");
        typeMap.set(paramName, "boolean");
      }

      // Pattern: json.decode(msg.Tags.ParamName) -> json type
      const jsonMatches = line.matchAll(
        /json\.decode\(msg\.Tags\.([A-Za-z][A-Za-z0-9]*)\)/g,
      );
      for (const match of jsonMatches) {
        const paramName = match[1];
        const normalizedName =
          paramName.charAt(0).toUpperCase() + paramName.slice(1);
        typeMap.set(normalizedName, "json");
        typeMap.set(paramName, "json");
      }

      // Pattern: Parameters that look like addresses (Target, Recipient, From, etc.)
      const addressMatches = line.matchAll(
        /msg\.Tags\.(Target|Recipient|From|Owner|Address|ProcessId)(?!\w)/gi,
      );
      for (const match of addressMatches) {
        const paramName = match[1];
        const normalizedName =
          paramName.charAt(0).toUpperCase() + paramName.slice(1);
        typeMap.set(normalizedName, "address");
        typeMap.set(paramName, "address");
      }
    }

    return typeMap;
  }

  /**
   * Check if msg.Data is used as a fallback for tag parameters
   */
  private isDataUsedAsFallback(handlerCode: string): boolean {
    // Check for patterns like "msg.Tags.A or msg.Data"
    return /msg\.Tags\.[A-Za-z][A-Za-z0-9]*\s+or\s+msg\.Data/.test(handlerCode);
  }
}
