# Design AO Process Architecture

## ⚠️ CRITICAL EXECUTION NOTICE ⚠️

**THIS IS AN EXECUTABLE WORKFLOW - NOT REFERENCE MATERIAL**

When this task is invoked:

1. **DISABLE ALL EFFICIENCY OPTIMIZATIONS** - This workflow requires full user interaction
2. **MANDATORY STEP-BY-STEP EXECUTION** - Each section must be processed sequentially with user feedback
3. **ELICITATION IS REQUIRED** - When `elicit: true`, you MUST use the 1-9 format and wait for user response
4. **NO MCP TOOLS ALLOWED** - This is technical design, not implementation

**VIOLATION INDICATOR:** If you use createProcess, evalProcess, or other MCP tools, you have violated this workflow.

## Architect Role Definition

As the **System Architect**, your role is to:

- **Design technical architecture** for AO processes based on business requirements
- **Select AO modules and patterns** appropriate for the use case
- **Design process communication** patterns and message flows
- **Define data structures** and handler specifications
- **Plan Permaweb integration** and deployment architecture
- **Create technical specifications** for developer implementation
- **NO IMPLEMENTATION** - You create "how it works" technical blueprints only

## Prerequisites

This task requires completed business requirements from the analyst agent:
- AO Process Requirements document
- User stories and acceptance criteria  
- Tokenomics specification
- Business constraints and success criteria

If these are not available, request them before proceeding.

## Critical: Template Discovery

If an AO Process Architecture Template has not been provided, list all ao-architecture templates from .bmad-core/templates or ask the user to provide one.

## CRITICAL: Mandatory Elicitation Format

**When `elicit: true`, this is a HARD STOP requiring user interaction:**

**YOU MUST:**

1. Present section content with technical architecture insights
2. Provide detailed rationale (explain technical trade-offs, architecture decisions, performance implications)
3. **STOP and present numbered options 1-9:**
   - **Option 1:** Always "Proceed to next section"
   - **Options 2-9:** Select 8 methods from data/elicitation-methods
   - End with: "Select 1-9 or just type your question/feedback:"
4. **WAIT FOR USER RESPONSE** - Do not proceed until user selects option or provides feedback

## Processing Flow

1. **Parse AO Architecture template** - Load template metadata and sections
2. **Review business requirements** - Understand constraints from analyst phase
3. **Set preferences** - Show current mode (Interactive), confirm output file
4. **Process each section:**
   - Focus on technical design and architecture decisions
   - Apply AO-specific patterns and best practices
   - Design for scalability, security, and performance
   - Present content + detailed technical rationale
   - **IF elicit: true** → MANDATORY 1-9 options format
   - Save to file if possible
5. **Continue until complete**
6. **Create developer handoff** with implementation specifications

## AO Architecture Design Principles

Apply comprehensive AO ecosystem technical knowledge:

- **Process Design Patterns**: Handler organization, state management, message processing
- **AO Module Selection**: Choose appropriate AOS modules and libraries
- **Inter-Process Communication**: Design message flows and communication protocols
- **Data Architecture**: Design state structures and data persistence patterns
- **Security Architecture**: Apply AO security best practices and validation patterns
- **Performance Architecture**: Optimize for AO compute constraints and cost efficiency
- **Permaweb Integration**: Design for permanent storage and discoverability

## Detailed Technical Rationale Requirements

When presenting section content, ALWAYS include technical rationale that explains:

- **Architecture decisions** and trade-offs between alternatives
- **AO-specific patterns** selected and why they fit the use case
- **Scalability considerations** and performance implications
- **Security architecture** decisions and threat mitigation
- **Integration patterns** with other AO processes and Permaweb
- **Deployment strategy** and infrastructure requirements
- **Testing strategy** and quality assurance approach

## Key Architecture Sections to Address

1. **Process Handler Architecture** - Handler organization and message routing
2. **State Management Design** - How process state is structured and updated
3. **Message Flow Design** - Inter-process communication patterns
4. **Data Schema Design** - State structures and message formats
5. **Security Architecture** - Authentication, authorization, validation patterns
6. **Integration Architecture** - External process and Permaweb integration
7. **Deployment Architecture** - Process deployment and management strategy
8. **Testing Architecture** - Testing patterns and quality assurance

## Handoff Requirements

At completion, create clear developer handoff documentation:

1. **Technical Specifications** - Detailed handler and state designs
2. **Implementation Requirements** - Specific coding requirements and constraints
3. **AO Module Dependencies** - Required modules and versions
4. **Message Schemas** - Exact message formats and validation rules
5. **Test Requirements** - Testing strategies and acceptance criteria
6. **Deployment Instructions** - Deployment process and configuration
7. **Developer Prompt** - Clear instructions for implementation phase

## CRITICAL REMINDERS

**❌ NEVER:**

- Use createProcess, evalProcess, or any MCP implementation tools
- Write actual process code or handlers (that's developer's job)
- Make business decisions (refer back to analyst requirements)
- Implement the design yourself
- Ask yes/no questions for elicitation
- Use any format other than 1-9 numbered options

**✅ ALWAYS:**

- Focus on technical architecture and system design
- Apply AO-specific architectural patterns and best practices
- Design for security, scalability, and maintainability
- Reference and build upon business requirements from analyst
- Use exact 1-9 format when elicit: true
- Provide detailed technical rationale for all decisions
- End with "Select 1-9 or just type your question/feedback:"
- Create comprehensive developer handoff documentation
- Design before implementing - architecture comes first