export interface AOLiteAssertion {
  customValidator?: string; // JavaScript function as string
  expected: any;
  id: string;
  message?: string;
  target: string; // JSONPath or property name
  type: "contains" | "custom" | "equals" | "exists" | "matches";
}

export interface AOLiteAssertionResult {
  actual: any;
  assertionId: string;
  expected: any;
  message?: string;
  status: "failed" | "passed";
}

export interface AOLiteEnvironment {
  configuration: AOLiteTestConfiguration;
  isRunning: boolean;
  messageQueue: AOLiteTestMessage[];
  processId: string;
  processSource: string;
  state: any;
}

export interface AOLiteMessageResult {
  duration: number;
  error?: string;
  messageId: string;
  response?: any;
  status: "failed" | "sent" | "timeout";
}

export interface AOLiteTestCase {
  assertions: AOLiteAssertion[];
  dependencies?: string[];
  description: string;
  id: string;
  messages: AOLiteTestMessage[];
  name: string;
  timeout: number;
}

export interface AOLiteTestCaseResult {
  assertionResults: AOLiteAssertionResult[];
  duration: number;
  error?: string;
  messageResults: AOLiteMessageResult[];
  status: "error" | "failed" | "passed";
  testCaseId: string;
}

export interface AOLiteTestConfiguration {
  concurrent?: boolean;
  coverage?: boolean;
  maxConcurrency?: number;
  retries?: number;
  timeout?: number;
  verbose?: boolean;
}

export interface AOLiteTestCoverage {
  coveragePercentage: number;
  coveredHandlers: string[];
  handlers: string[];
  uncoveredHandlers: string[];
}

export interface AOLiteTestMessage {
  action: string;
  data?: any;
  delay?: number;
  expectedResponse?: any;
  id: string;
  tags?: { name: string; value: string }[];
}

export interface AOLiteTestResults {
  coverage?: AOLiteTestCoverage;
  duration: number;
  erroredTests: number;
  failedTests: number;
  passedTests: number;
  results: AOLiteTestCaseResult[];
  status: "error" | "failed" | "passed";
  testSuiteId: string;
  totalTests: number;
}

export interface AOLiteTestSetup {
  dependencies?: string[];
  environment?: Record<string, any>;
  initializeProcess?: boolean;
  initialState?: any;
  processSource?: string;
}

export interface AOLiteTestSuite {
  configuration: AOLiteTestConfiguration;
  id: string;
  name: string;
  processId: string;
  setup: AOLiteTestSetup;
  teardown: AOLiteTestTeardown;
  testCases: AOLiteTestCase[];
}

export interface AOLiteTestTeardown {
  cleanupData?: boolean;
  cleanupProcess?: boolean;
  resetState?: boolean;
}
