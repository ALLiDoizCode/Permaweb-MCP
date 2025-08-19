import { beforeEach, describe, expect, it } from "vitest";

import { ParameterExtractionService } from "../../../src/services/ParameterExtractionService.js";

describe("ParameterExtractionService", () => {
  let service: ParameterExtractionService;

  beforeEach(() => {
    service = new ParameterExtractionService();
  });

  describe("extractParametersFromHandler", () => {
    it("should extract parameters from calculator Add handler", () => {
      const handlerCode = `
        local a = tonumber(msg.Tags.A or msg.Tags.a or msg.Data)
        local b = tonumber(msg.Tags.B or msg.Tags.b or "0")
        
        if not a or not b then
          ao.send({
            Target = msg.From,
            Action = "Error",
            Data = "Invalid input. Please provide numeric values for A and B."
          })
          return
        end
        
        local result = a + b
        ao.send({
          Target = msg.From,
          Action = "Sum",
          Data = tostring(result)
        })
      `;

      const parameters = service.extractParametersFromHandler(
        handlerCode,
        "Add",
      );

      expect(parameters).toHaveLength(2);

      const paramA = parameters.find((p) => p.name === "A");
      expect(paramA).toBeDefined();
      expect(paramA?.type).toBe("number");
      expect(paramA?.required).toBe(true);
      expect(paramA?.description).toContain("First operand");

      const paramB = parameters.find((p) => p.name === "B");
      expect(paramB).toBeDefined();
      expect(paramB?.type).toBe("number");
      expect(paramB?.required).toBe(false); // has default value
    });

    it("should extract address-type parameters", () => {
      const handlerCode = `
        local target = msg.Tags.Target or msg.From
        local recipient = msg.Tags.Recipient
        
        if not recipient then
          ao.send({
            Target = msg.From,
            Action = "Error",
            Data = "Recipient is required"
          })
          return
        end
      `;

      const parameters = service.extractParametersFromHandler(
        handlerCode,
        "Transfer",
      );

      expect(parameters).toHaveLength(2);

      const targetParam = parameters.find((p) => p.name === "Target");
      expect(targetParam).toBeDefined();
      expect(targetParam?.type).toBe("address");
      expect(targetParam?.required).toBe(false);

      const recipientParam = parameters.find((p) => p.name === "Recipient");
      expect(recipientParam).toBeDefined();
      expect(recipientParam?.type).toBe("address");
      expect(recipientParam?.required).toBe(true);
    });

    it("should extract boolean parameters", () => {
      const handlerCode = `
        local enabled = msg.Tags.Enabled == "true"
        local force = msg.Tags.Force == "yes"
        
        if enabled and force then
          -- do something
        end
      `;

      const parameters = service.extractParametersFromHandler(
        handlerCode,
        "Configure",
      );

      expect(parameters).toHaveLength(2);

      const enabledParam = parameters.find((p) => p.name === "Enabled");
      expect(enabledParam?.type).toBe("boolean");

      const forceParam = parameters.find((p) => p.name === "Force");
      expect(forceParam?.type).toBe("boolean");
    });

    it("should extract JSON parameters", () => {
      const handlerCode = `
        local config = json.decode(msg.Tags.Config)
        local data = json.decode(msg.Data)
      `;

      const parameters = service.extractParametersFromHandler(
        handlerCode,
        "Configure",
      );

      const configParam = parameters.find((p) => p.name === "Config");
      expect(configParam?.type).toBe("json");

      const dataParam = parameters.find((p) => p.name === "Data");
      expect(dataParam?.type).toBe("json");
    });

    it("should generate validation rules for different parameter types", () => {
      const handlerCode = `
        local quantity = tonumber(msg.Tags.Quantity)
        local vote = msg.Tags.Vote
        local target = msg.Tags.Target
      `;

      const parameters = service.extractParametersFromHandler(
        handlerCode,
        "Vote",
      );

      const quantityParam = parameters.find((p) => p.name === "Quantity");
      expect(quantityParam?.validation?.min).toBe(0);

      const voteParam = parameters.find((p) => p.name === "Vote");
      expect(voteParam?.validation?.enum).toEqual(["yes", "no"]);

      const targetParam = parameters.find((p) => p.name === "Target");
      expect(targetParam?.validation?.pattern).toBe("^[a-zA-Z0-9_-]{43}$");
    });

    it("should generate appropriate examples for parameters", () => {
      const handlerCode = `
        local a = tonumber(msg.Tags.A)
        local target = msg.Tags.Target
        local vote = msg.Tags.Vote
      `;

      const parameters = service.extractParametersFromHandler(
        handlerCode,
        "Test",
      );

      const aParam = parameters.find((p) => p.name === "A");
      expect(aParam?.examples).toEqual(["15", "100", "42"]);

      const targetParam = parameters.find((p) => p.name === "Target");
      expect(targetParam?.examples).toHaveLength(2);
      expect(targetParam?.examples?.[0]).toMatch(/^[a-zA-Z0-9_-]{43}$/);

      const voteParam = parameters.find((p) => p.name === "Vote");
      expect(voteParam?.examples).toEqual(["yes", "no"]);
    });
  });

  describe("extractParametersFromCode", () => {
    it("should extract parameters from complete Lua code with multiple handlers", () => {
      const luaCode = `
        Handlers.add(
          "addition",
          Handlers.utils.hasMatchingTag("Action", "Add"),
          function(msg)
            local a = tonumber(msg.Tags.A or msg.Tags.a or msg.Data)
            local b = tonumber(msg.Tags.B or msg.Tags.b or "0")
          end
        )
        
        Handlers.add(
          "transfer",
          Handlers.utils.hasMatchingTag("Action", "Transfer"),
          function(msg)
            local quantity = tonumber(msg.Tags.Quantity)
            local recipient = msg.Tags.Recipient
          end
        )
      `;

      const parameterMap = service.extractParametersFromCode(luaCode);

      expect(parameterMap.size).toBe(2);

      const addParams = parameterMap.get("Add");
      expect(addParams).toHaveLength(2);
      expect(addParams?.find((p) => p.name === "A")?.type).toBe("number");

      const transferParams = parameterMap.get("Transfer");
      expect(transferParams).toHaveLength(2);
      expect(transferParams?.find((p) => p.name === "Quantity")?.type).toBe(
        "number",
      );
      expect(transferParams?.find((p) => p.name === "Recipient")?.type).toBe(
        "address",
      );
    });

    it("should handle handlers without parameters", () => {
      const luaCode = `
        Handlers.add(
          "ping",
          Handlers.utils.hasMatchingTag("Action", "Ping"),
          function(msg)
            ao.send({
              Target = msg.From,
              Action = "Pong",
              Data = "pong"
            })
          end
        )
      `;

      const parameterMap = service.extractParametersFromCode(luaCode);

      expect(parameterMap.size).toBe(1);
      const pingParams = parameterMap.get("Ping");
      expect(pingParams).toHaveLength(0);
    });
  });
});
