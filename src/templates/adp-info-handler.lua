-- AO Documentation Protocol (ADP) v1.0 - Info Handler Template
-- 
-- This template provides ADP-compliant Info handler for manual process deployment.
-- It enables automatic process discovery and handler metadata extraction by tools
-- like Permamind's executeAction command.
--
-- Usage:
--   1. Copy this template into your process code
--   2. Customize the process metadata (name, description, etc.)
--   3. Update the PROCESS_HANDLERS table with your actual handlers
--   4. Deploy using evalProcess
--
-- Example customization:
--   PROCESS_NAME = "My Custom Process"
--   PROCESS_DESCRIPTION = "Custom AO process with specific functionality"
--   
-- Handler Definition Format:
--   {
--     action = "HandlerName",           -- The action tag value
--     pattern = {"Action"},             -- Required routing tags
--     parameters = {                    -- Optional parameter definitions
--       {
--         name = "Target",             -- Parameter name
--         type = "address",            -- string|number|boolean|address|json
--         required = true,             -- true|false
--         description = "Description", -- Human-readable description
--         examples = {"example1"},     -- Array of example values
--         validation = {               -- Optional validation rules
--           pattern = "^[a-zA-Z0-9_-]{43}$",  -- Regex for strings
--           min = 1,                   -- Min value for numbers
--           max = 100,                 -- Max value for numbers  
--           enum = {"val1", "val2"}    -- Allowed values
--         }
--       }
--     },
--     description = "What this handler does",
--     examples = {"Example usage"},
--     category = "core"                -- core|utility|custom
--   }

-- CUSTOMIZE THESE VALUES FOR YOUR PROCESS
local PROCESS_NAME = "Custom AO Process"
local PROCESS_DESCRIPTION = "ADP-compliant process template"
local PROCESS_TICKER = nil  -- Optional ticker symbol
local PROCESS_LOGO = nil    -- Optional logo URL

-- DEFINE YOUR HANDLERS HERE
-- Replace this array with your actual process handlers
local PROCESS_HANDLERS = {
    {
        action = "Info",
        pattern = {"Action"},
        description = "Get process information and handler metadata",
        examples = {"Send Info message to get process details"},
        category = "core"
    },
    {
        action = "Ping", 
        pattern = {"Action"},
        description = "Test if process is responding",
        examples = {"Send Ping to test connectivity"},
        category = "utility"
    }
    -- ADD YOUR CUSTOM HANDLERS HERE
    -- Example:
    -- {
    --     action = "CustomAction",
    --     pattern = {"Action"},
    --     parameters = {
    --         {
    --             name = "Target",
    --             type = "address", 
    --             required = true,
    --             description = "Target address for action"
    --         }
    --     },
    --     description = "Performs custom action",
    --     category = "custom"
    -- }
}

-- ADP COMPLIANCE VALIDATION FUNCTION
local function validateADPCompliance()
    local errors = {}
    
    -- Check required fields
    if not PROCESS_NAME or PROCESS_NAME == "" then
        table.insert(errors, "PROCESS_NAME must be defined")
    end
    
    if not PROCESS_HANDLERS or #PROCESS_HANDLERS == 0 then
        table.insert(errors, "PROCESS_HANDLERS must contain at least one handler")
    end
    
    -- Validate handler structure
    for i, handler in ipairs(PROCESS_HANDLERS) do
        if not handler.action then
            table.insert(errors, "Handler " .. i .. " missing required 'action' field")
        end
        
        if not handler.pattern or type(handler.pattern) ~= "table" or #handler.pattern == 0 then
            table.insert(errors, "Handler " .. i .. " missing required 'pattern' array")
        end
        
        if handler.category and not (handler.category == "core" or handler.category == "utility" or handler.category == "custom") then
            table.insert(errors, "Handler " .. i .. " has invalid category (must be core, utility, or custom)")
        end
    end
    
    return #errors == 0, errors
end

-- GENERATE ADP-COMPLIANT INFO RESPONSE
local function generateInfoResponse()
    local infoResponse = {
        -- Standard AO process fields
        Name = PROCESS_NAME,
        Description = PROCESS_DESCRIPTION,
        Owner = Owner or ao.env.Process.Owner,
        ProcessId = ao.id,
        
        -- ADP v1.0 required fields
        protocolVersion = "1.0",
        lastUpdated = os.date("!%Y-%m-%dT%H:%M:%S.000Z"),
        handlers = PROCESS_HANDLERS,
        
        -- ADP capabilities
        capabilities = {
            supportsHandlerRegistry = true,
            supportsTagValidation = true,
            supportsExamples = true
        }
    }
    
    -- Add optional fields if defined
    if PROCESS_TICKER then
        infoResponse.Ticker = PROCESS_TICKER
    end
    
    if PROCESS_LOGO then
        infoResponse.Logo = PROCESS_LOGO
    end
    
    return infoResponse
end

-- ADP-COMPLIANT INFO HANDLER
Handlers.add('Info', Handlers.utils.hasMatchingTag('Action', 'Info'), function(msg)
    -- Validate ADP compliance before responding
    local isValid, errors = validateADPCompliance()
    
    if not isValid then
        print("ADP Compliance Warning: " .. table.concat(errors, ", "))
        -- Still respond with basic info for backward compatibility
        ao.send({
            Target = msg.From,
            Data = json.encode({
                Name = PROCESS_NAME,
                Description = PROCESS_DESCRIPTION,
                Owner = Owner or ao.env.Process.Owner,
                ProcessId = ao.id,
                Error = "ADP compliance validation failed: " .. table.concat(errors, ", ")
            })
        })
        return
    end
    
    -- Generate and send ADP-compliant response
    local infoResponse = generateInfoResponse()
    
    ao.send({
        Target = msg.From,
        Data = json.encode(infoResponse)
    })
    
    print("Sent ADP v1.0 compliant Info response to " .. msg.From)
end)

-- BASIC PING HANDLER (commonly expected)
Handlers.add('Ping', Handlers.utils.hasMatchingTag('Action', 'Ping'), function(msg)
    ao.send({
        Target = msg.From,
        Data = "pong"
    })
end)

-- USAGE INSTRUCTIONS
print("=== ADP Info Handler Template Loaded ===")
print("Process: " .. PROCESS_NAME)
print("ADP Version: 1.0")
print("Handlers: " .. #PROCESS_HANDLERS)

-- Validate on load
local isValid, errors = validateADPCompliance()
if isValid then
    print("✓ ADP compliance validation passed")
else
    print("⚠ ADP compliance warnings:")
    for _, error in ipairs(errors) do
        print("  - " .. error)
    end
end

print("Send 'Info' message to get ADP-compliant process metadata")
print("==========================================")