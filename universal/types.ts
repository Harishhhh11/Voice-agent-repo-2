export type UniversalEntityType =
  | "service"
  | "product"
  | "person"
  | "location"
  | "room"
  | "doctor"
  | "department"
  | "property"
  | "menu_item"
  | "course"
  | "plan"
  | "package"
  | "facility"
  | "membership"
  | "policy"
  | "faq"
  | "custom";

export interface UniversalAttribute {
  key: string;
  label: string;
  value: string | number | boolean | string[];
  valueType: "string" | "number" | "currency" | "time" | "date" | "boolean" | "list";
  unit?: string;
  isFilterable?: boolean;
}

export interface UniversalRelationship {
  sourceEntityId: string;
  targetEntityId: string;
  relationType:
    | "has_service"
    | "employs"
    | "specializes_in"
    | "has_price"
    | "available_at"
    | "located_in"
    | "offers"
    | "requires"
    | "sub_entity_of"
    | "conflicts_with"
    | "similar_to"
    | "includes";
  metadata?: Record<string, unknown>;
}

export interface UniversalEntity {
  id: string;
  name: string;
  type: UniversalEntityType;
  aliases: string[];
  category?: string;
  description?: string;
  attributes: Record<string, UniversalAttribute>;
  relationships: UniversalRelationship[];
  sourceDocId?: number;
  sourceDocTitle?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface UniversalPolicy {
  id: string;
  name: string;
  category: "cancellation" | "refund" | "booking" | "privacy" | "prerequisite" | "safety" | "general";
  rules: string[];
  conditions?: string[];
  sourceDocId?: number;
}

export interface UniversalSchedule {
  id: string;
  entityId?: string;
  entityName?: string;
  dayOfWeek?: string[];
  startTime?: string;
  endTime?: string;
  timezone?: string;
  description?: string;
  slotsAvailable?: number;
  recurrence?: string;
  sourceDocId?: number;
}

export interface UniversalPricing {
  id: string;
  entityId?: string;
  entityName?: string;
  amount: number;
  currency: string;
  billingPeriod?: "one-time" | "monthly" | "yearly" | "per-night" | "hourly" | "per-person" | "custom";
  discountAvailable?: boolean;
  discountDetails?: string;
  taxIncluded?: boolean;
  formattedDisplay: string;
  sourceDocId?: number;
}

export interface UniversalDocumentItem {
  id: string;
  title: string;
  docType: "brochure" | "catalog" | "price_list" | "menu" | "syllabus" | "guide" | "form" | "policy" | "general";
  description?: string;
  url?: string;
  sourceDocId?: number;
}

export interface UniversalFact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  source: string;
  docId?: number;
  confidence: number;
}

export interface UniversalOrganizationInfo {
  id?: number;
  name: string;
  industry?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  businessHours?: string;
  timezone?: string;
  emergencyContact?: string;
}

export interface UniversalKnowledgeModel {
  organization: UniversalOrganizationInfo;
  entities: UniversalEntity[];
  facts: UniversalFact[];
  relationships: UniversalRelationship[];
  policies: UniversalPolicy[];
  schedules: UniversalSchedule[];
  pricing: UniversalPricing[];
  documents: UniversalDocumentItem[];
  actions: { name: string; description: string; requiredFields: string[] }[];
  constraints: { rule: string; appliesTo?: string }[];
  rawDocs: { id: number; title: string; content: string; source?: string; category?: string }[];
}

export type UniversalIntentType =
  | "GREETING"
  | "GENERAL_INFORMATION"
  | "ENTITY_INFORMATION"
  | "ATTRIBUTE_QUERY"
  | "SEARCH"
  | "FILTER"
  | "COMPARISON"
  | "RECOMMENDATION_REQUEST"
  | "AVAILABILITY"
  | "PRICE_QUERY"
  | "SCHEDULE_QUERY"
  | "LOCATION_QUERY"
  | "CONTACT_QUERY"
  | "POLICY_QUERY"
  | "REQUIREMENT_QUERY"
  | "STATUS_QUERY"
  | "EXPLANATION"
  | "CALCULATION"
  | "QUOTE_REQUEST"
  | "BOOKING"
  | "APPOINTMENT"
  | "ORDER"
  | "PURCHASE"
  | "CANCELLATION"
  | "MODIFICATION"
  | "REGISTRATION"
  | "APPLICATION"
  | "LEAD_CAPTURE"
  | "DOCUMENT_REQUEST"
  | "HUMAN_HANDOFF"
  | "COMPLAINT"
  | "FEEDBACK"
  | "FOLLOW_UP"
  | "CONFIRMATION"
  | "REJECTION"
  | "CLARIFICATION"
  | "CHITCHAT"
  | "UNKNOWN"
  | "MULTI_INTENT";

export interface UniversalIntentResult {
  primaryIntent: UniversalIntentType;
  subIntents: { intent: UniversalIntentType; targetEntity?: string; targetAttribute?: string }[];
  confidence: number;
  isActionable: boolean;
  requiresClarification: boolean;
  detectedLanguage: "en" | "te" | "hi";
}

export interface UniversalStateMemory {
  topic_stack: { entityId?: string; entityName?: string; intent: UniversalIntentType; timestamp: number }[];
  current_entity?: UniversalEntity;
  active_filters: Record<string, string | number | boolean>;
  entity_preferences: Record<string, Record<string, string | number | boolean>>;
  customer_info: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    company?: string | null;
    customFields?: Record<string, string>;
  };
  workflow_state: "DISCOVERY" | "QUALIFICATION" | "DETAIL_COLLECTION" | "CONFIRMATION" | "ACTION_COMPLETED";
  workflow_step?: string;
  lead_id?: number | null;
  idempotency_keys: string[];
}

export interface UniversalToolResult {
  tool: string;
  success: boolean;
  args: Record<string, unknown>;
  output: unknown;
  error?: string;
}
