import { get, post } from "./client";

export interface LabSimulationResponse {
  scenario: string;
  input_prompt: string;
  response: string;
  telemetry: {
    detected_intent: string;
    detected_language: "en" | "te" | "hi";
    conversation_state: string;
    is_escalated: boolean;
    tool_calls_executed: { tool: string; args: Record<string, unknown>; result: unknown }[];
    grounding_sources_cited: { id: number; title: string; source: string }[];
    prompt_injection_flagged: boolean;
  };
}

export interface GoldenTurnResult {
  turn_number: number;
  user_input: string;
  assistant_reply: string;
  detected_intent: string;
  current_topic: string;
  state_snapshot: string;
  selected_courses: string[];
  course_preferences: Record<string, { mode?: string | null; batch?: string | null }>;
  customer_info: { name?: string | null; phone?: string | null; email?: string | null };
  lead_created_or_updated: boolean;
  grounding_sources: { id: number; title: string; source: string }[];
  passed: boolean;
  check_notes: string;
}

export interface EvaluationReport {
  timestamp: string;
  agent_id: number;
  agent_name: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  intent_accuracy_pct: number;
  entity_accuracy_pct: number;
  grounded_answer_rate_pct: number;
  hallucination_rate_pct: number;
  tool_accuracy_pct: number;
  state_transition_accuracy_pct: number;
  lead_mutation_policy_compliance_pct: number;
  average_latency_ms: number;
  failure_rate_pct: number;
  category_breakdown: Record<string, { total: number; passed: number; accuracy_pct: number }>;
  golden_conversation_results: GoldenTurnResult[];
}

export async function simulateLabTest(params: {
  scenario?: string;
  custom_prompt?: string;
  agent_id?: number;
}): Promise<LabSimulationResponse> {
  return post<LabSimulationResponse, typeof params>("/lab/simulate", params);
}

export async function getEvaluationReport(): Promise<EvaluationReport> {
  return get<EvaluationReport>("/lab/evaluation-report");
}

export async function runEvaluationSuite(params: { agent_id?: number }): Promise<EvaluationReport> {
  return post<EvaluationReport, typeof params>("/lab/evaluate", params);
}

export async function runGoldenTest(params: { agent_id?: number }): Promise<{ golden_conversation_results: GoldenTurnResult[]; passed: boolean }> {
  return post<{ golden_conversation_results: GoldenTurnResult[]; passed: boolean }, typeof params>("/lab/golden-test", params);
}

export interface UniversalBenchmarkReport {
  totalTests: number;
  passed: number;
  failed: number;
  accuracy: number;
  hallucinationRate: number;
  toolSafetyScore: number;
  tenantIsolationScore: number;
  stateConsistencyScore: number;
  intentAccuracy: number;
  entityAccuracy: number;
  averageLatencyMs: number;
  criticalFailures: number;
  domainsTested: string[];
  results: {
    turnId: number;
    domain: string;
    category: string;
    prompt: string;
    reply: string;
    passed: boolean;
    reason?: string;
    latencyMs: number;
  }[];
}

export interface DynamicTestSuiteResponse {
  success: boolean;
  domain: string;
  total_generated: number;
  knowledge_summary: {
    entities_count: number;
    policies_count: number;
    pricing_count: number;
    schedules_count: number;
  };
  tests: {
    turnId: number;
    domain: string;
    category: string;
    prompt: string;
    expectedIntent: string;
    expectedEntity?: string;
    expectedFactInReply?: string;
    mustNotContain?: string[];
  }[];
}

export interface IndustryTemplateItem {
  agent: {
    id: number;
    name: string;
    industry: string;
    system_prompt: string;
    voice_enabled: boolean;
    voice_name: string;
    greeting_message: string;
    tools: string[];
    personality: string;
    business_type: string;
  };
  documents_count: number;
  documents: {
    id: number;
    title: string;
    category: string;
    content?: string;
  }[];
}

export async function runUniversalBenchmarkApi(): Promise<UniversalBenchmarkReport> {
  return get<UniversalBenchmarkReport>("/universal/benchmark");
}

export async function generateDynamicTestSuiteApi(params: {
  agent_id?: number;
  count?: number;
  domain_name?: string;
}): Promise<DynamicTestSuiteResponse> {
  return post<DynamicTestSuiteResponse, typeof params>("/universal/dynamic-test-suite", params);
}

export async function getUniversalIndustriesApi(): Promise<{ industries: IndustryTemplateItem[] }> {
  return get<{ industries: IndustryTemplateItem[] }>("/universal/industries");
}


