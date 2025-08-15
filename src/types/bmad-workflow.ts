/**
 * BMad Workflow and Tool Types
 *
 * TypeScript interfaces for BMad methodology integration with Permamind MCP tools.
 * These types support workflow execution, agent invocation, and task management
 * with file-based I/O for context efficiency.
 */

/**
 * Configuration interface for BMad agent invocation
 */
export interface BmadAgentArgs {
  /** BMad agent type to invoke */
  agentName: "analyst" | "architect" | "dev" | "pm" | "po" | "qa" | "sm";
  /** Optional file paths for agent context */
  contextFiles?: string[];
  /** Optional minimal context for agent transitions */
  handoffSummary?: string;
  /** Path for agent output files */
  outputPath: string;
  /** Natural language task description */
  task: string;
}

/**
 * Result interface for BMad agent operations
 */
export interface BmadAgentResult {
  /** Error details if execution failed */
  error?: string;
  /** Generated file paths */
  generatedFiles?: string[];
  /** Agent execution message */
  message: string;
  /** Output file path */
  outputPath?: string;
  /** Whether the agent execution succeeded */
  success: boolean;
}

/**
 * Configuration interface for BMad task execution
 */
export interface BmadTaskArgs {
  /** Task-specific configuration */
  configuration: TaskConfiguration;
  /** Input file paths */
  inputFiles: string[];
  /** Expected output file paths */
  outputFiles: string[];
  /** Specific BMad task identifier */
  taskName: string;
}

/**
 * Result interface for BMad task operations
 */
export interface BmadTaskResult {
  /** Error details if execution failed */
  error?: string;
  /** Task execution message */
  message: string;
  /** Output file paths */
  outputFiles?: string[];
  /** Whether the task executed successfully */
  success: boolean;
}

/**
 * Configuration interface for BMad workflow execution
 */
export interface BmadWorkflowArgs {
  /** Optional workflow configuration */
  configuration?: {
    /** Context window optimization setting */
    contextWindow?: number;
    /** Enable guided vs autonomous execution */
    guided?: boolean;
    /** File formats for document generation */
    outputFormats?: string[];
  };
  /** Base path for project files */
  projectPath: string;
  /** Natural language workflow requirements */
  userRequest: string;
  /** The BMad workflow type to execute */
  workflowName:
    | "brownfield-fullstack"
    | "greenfield-fullstack"
    | "permaweb-fullstack";
}

/**
 * Result interface for BMad workflow operations
 */
export interface BmadWorkflowResult {
  /** Error details if execution failed */
  error?: string;
  /** Generated file paths */
  generatedFiles?: string[];
  /** Workflow execution message */
  message: string;
  /** Whether the workflow executed successfully */
  success: boolean;
}

/**
 * Configuration for BMad task execution
 */
export interface TaskConfiguration {
  /** Execution mode (guided or autonomous) */
  mode?: "autonomous" | "guided";
  /** Output format preferences */
  outputFormat?: string;
  /** Task-specific parameters */
  parameters?: Record<string, unknown>;
}
