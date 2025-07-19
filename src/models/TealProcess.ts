export interface TealCompileOptions {
  checkOnly?: boolean;
  includeDir?: string[];
  outputDir?: string;
  strict?: boolean;
  target?: "lua53" | "lua54" | "luajit";
  warnings?: boolean;
}

export interface TealCompileResult {
  compiledLua?: string;
  errors?: string[];
  success: boolean;
  typeChecks?: TealTypeCheckResult[];
  warnings?: string[];
}

export interface TealProcessDefinition {
  compiledLua: string; // compiled Lua output
  dependencies: string[];
  id: string;
  metadata: TealProcessMetadata;
  name: string;
  source: string; // .tl source code
  typeDefinitions: TealTypeDefinition[];
  version: string;
}

export interface TealProcessMetadata {
  aoVersion: string;
  author: string;
  compileOptions: TealCompileOptions;
  description: string;
  version: string;
}

export interface TealTemplate {
  category: "dao" | "game" | "generic" | "token";
  dependencies: string[];
  description: string;
  metadata: {
    aoVersion: string;
    author: string;
    features: string[];
    version: string;
  };
  name: string;
  source: string;
}

export interface TealTypeCheckResult {
  column: number;
  file: string;
  line: number;
  message: string;
  severity: "error" | "warning";
}

export interface TealTypeDefinition {
  definition: string;
  documentation?: string;
  name: string;
  type: "alias" | "enum" | "function" | "record";
}
