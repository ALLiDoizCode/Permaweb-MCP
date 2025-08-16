# AHRP to ADP Migration Guide

## Overview

This guide helps you migrate from **AO Handler Registry Protocol (AHRP)** to the new **AO Documentation Protocol (ADP)**. The rebrand reflects the protocol's core purpose: automatic API documentation for AO processes.

## What's Changing

### **Name Changes**

| **Old**                             | **New**                         |
| ----------------------------------- | ------------------------------- |
| AO Handler Registry Protocol (AHRP) | AO Documentation Protocol (ADP) |
| HandlerRegistryProtocolService      | DocumentationProtocolService    |
| ahrp-specification.md               | adp-specification.md            |
| token-blueprint-ahrp.md             | token-blueprint-adp.md          |

### **What's Staying the Same**

✅ **Protocol Version**: Still v1.0  
✅ **JSON Structure**: Identical response format  
✅ **Implementation**: No code changes required  
✅ **Compatibility**: Fully backward compatible  
✅ **Functionality**: All features remain unchanged

## Migration Steps

### **For Process Developers**

#### **1. Update Comments (Optional)**

```lua
-- OLD
-- Enhanced Info Handler with Handler Registry Protocol (AHRP) v1.0

-- NEW
-- Enhanced Info Handler with AO Documentation Protocol (ADP) v1.0
```

#### **2. Update Documentation References**

- Replace "AHRP" with "ADP" in your documentation
- Update protocol references to "AO Documentation Protocol"
- Keep all implementation details the same

#### **3. No Code Changes Required**

Your existing implementation continues to work unchanged:

```lua
-- This continues to work exactly as before
local infoResponse = {
    protocolVersion = "1.0",  -- Still v1.0
    handlers = { ... },       -- Same structure
    capabilities = { ... }    -- Same capabilities
}
```

### **For Tool Developers**

#### **1. Update Service References**

- Replace "HandlerRegistryProtocolService" with "DocumentationProtocolService"
- Update service method calls to use new naming
- Maintain same function signatures and return types

#### **2. Update Detection Logic**

- Same detection algorithm works unchanged
- Look for `protocolVersion: "1.0"` and `handlers` array
- No changes to JSON parsing logic required

#### **3. Update Documentation**

- Replace "AHRP" references with "ADP"
- Update protocol name in error messages
- Revise marketing copy to emphasize "documentation"

### **For End Users**

#### **No Action Required**

- All existing processes continue to work
- No changes to message formats
- Tools automatically handle the transition

## Marketing Messaging Updates

### **Old Messaging**

"AHRP enables handler discovery and registry functionality"

### **New Messaging**

"ADP provides automatic API documentation for AO processes"

### **Key Benefits to Emphasize**

- **Self-Documenting**: Processes document themselves automatically
- **Zero Maintenance**: API docs never go out of date
- **Developer Experience**: Instant understanding of any process
- **Tool Integration**: Intelligent tooling with automatic discovery

## Timeline

### **Immediate (Now)**

- ✅ Update internal documentation and references
- ✅ Begin using "ADP" terminology in new projects
- ✅ Update service names in new code

### **Short-term (1-2 weeks)**

- Update existing documentation
- Update service references
- Update error messages and logs

### **Medium-term (1 month)**

- Complete migration of all references
- Update training materials
- Revise marketing content

### **Long-term (Ongoing)**

- Use "ADP" as the standard reference
- Educate ecosystem about the new name
- Phase out "AHRP" terminology

## Backward Compatibility

### **Guaranteed Compatibility**

- All existing implementations continue working
- No breaking changes to JSON responses
- Protocol version remains "1.0"
- Message patterns unchanged

### **Detection Logic**

Tools can detect ADP processes using the same approach:

- Check response contains `protocolVersion: "1.0"`
- Verify `handlers` field is an array
- Parse JSON response for ADP metadata

## FAQ

### **Q: Do I need to update my existing processes?**

**A:** No, existing processes work unchanged. Only update comments/docs if desired.

### **Q: Will old tools break?**

**A:** No, all tools continue working. The JSON structure is identical.

### **Q: Should I use ADP or AHRP in new projects?**

**A:** Use "ADP" for all new documentation and references.

### **Q: When will AHRP references be deprecated?**

**A:** AHRP references are discouraged but not deprecated. Focus on using ADP going forward.

### **Q: Do I need to change my protocol version?**

**A:** No, keep `protocolVersion: "1.0"`. The version tracks the specification, not the name.

## Benefits of the New Name

### **Clearer Purpose**

- "Documentation" immediately conveys the value
- Less technical jargon for non-developers
- Focuses on benefits rather than implementation

### **Better Marketing**

- "Automatic API documentation" sells itself
- Easier to explain to stakeholders
- Aligns with developer pain points

### **Broader Scope**

- Can encompass future documentation features
- Not limited to just "handlers" and "registry"
- Room for protocol evolution

## Support

### **Questions?**

- Check the [ADP Specification](./adp-specification.md)
- Review the [Token Blueprint](./token-blueprint-adp.md)
- Open an issue for migration help

### **Need Help?**

The migration is designed to be seamless. If you encounter any issues:

1. Verify your JSON structure matches the specification
2. Check that `protocolVersion: "1.0"` is present
3. Ensure `handlers` array is included in responses

## Conclusion

The AHRP → ADP migration is primarily a **rebrand** with **zero breaking changes**. The new name better reflects the protocol's revolutionary capability: making AO processes self-documenting.

Continue building amazing self-documenting processes with the **AO Documentation Protocol**! 🚀
