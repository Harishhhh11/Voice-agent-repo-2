import type {
  UniversalStateMemory,
  UniversalEntity,
  UniversalIntentType,
} from "./types";

export interface ConversationStateUpdate {
  visitorName?: string | null;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  visitorCompany?: string | null;
  activeEntity?: UniversalEntity;
  activeIntent?: UniversalIntentType;
  newFilters?: Record<string, string | number | boolean>;
  newPreferences?: Record<string, string | number | boolean>;
  workflowState?: UniversalStateMemory["workflow_state"];
  workflowStep?: string;
  leadId?: number | null;
}

/**
 * Universal Conversational State Manager
 * Maintains topic stack, entity-specific preferences, structured filters, and non-intrusive lead tracking.
 */
export function initializeUniversalState(existingState?: Partial<UniversalStateMemory>): UniversalStateMemory {
  return {
    topic_stack: existingState?.topic_stack || [],
    current_entity: existingState?.current_entity,
    active_filters: existingState?.active_filters || {},
    entity_preferences: existingState?.entity_preferences || {},
    customer_info: {
      name: existingState?.customer_info?.name || null,
      phone: existingState?.customer_info?.phone || null,
      email: existingState?.customer_info?.email || null,
      company: existingState?.customer_info?.company || null,
      customFields: existingState?.customer_info?.customFields || {},
    },
    workflow_state: existingState?.workflow_state || "DISCOVERY",
    workflow_step: existingState?.workflow_step,
    lead_id: existingState?.lead_id || null,
    idempotency_keys: existingState?.idempotency_keys || [],
  };
}

/**
 * Updates conversational state with new entity focus, filters, and extracted customer details.
 * Prevents preference bleed across entities.
 */
export function updateUniversalState(
  state: UniversalStateMemory,
  update: ConversationStateUpdate
): UniversalStateMemory {
  const updated: UniversalStateMemory = {
    ...state,
    customer_info: { ...state.customer_info },
    active_filters: { ...state.active_filters, ...(update.newFilters || {}) },
    entity_preferences: { ...state.entity_preferences },
  };

  // Update customer info if valid values provided
  if (update.visitorName && isValidCustomerName(update.visitorName)) {
    updated.customer_info.name = update.visitorName.trim();
  }
  if (update.visitorPhone && isValidPhone(update.visitorPhone)) {
    updated.customer_info.phone = update.visitorPhone.trim();
  }
  if (update.visitorEmail && isValidEmail(update.visitorEmail)) {
    updated.customer_info.email = update.visitorEmail.trim();
  }
  if (update.visitorCompany && update.visitorCompany.trim().length > 1) {
    updated.customer_info.company = update.visitorCompany.trim();
  }

  // Handle entity transition and topic stack
  if (update.activeEntity) {
    const currentId = updated.current_entity?.id;
    if (currentId && currentId !== update.activeEntity.id) {
      // Push previous entity to stack
      updated.topic_stack = [
        ...updated.topic_stack,
        {
          entityId: updated.current_entity?.id,
          entityName: updated.current_entity?.name,
          intent: update.activeIntent || "ENTITY_INFORMATION",
          timestamp: Date.now(),
        },
      ].slice(-10); // keep last 10 topics
    }
    updated.current_entity = update.activeEntity;

    // Apply entity-specific preferences to this entity ONLY
    if (update.newPreferences && Object.keys(update.newPreferences).length > 0) {
      const entId = update.activeEntity.id;
      updated.entity_preferences[entId] = {
        ...(updated.entity_preferences[entId] || {}),
        ...update.newPreferences,
      };
    }
  }

  if (update.workflowState) {
    updated.workflow_state = update.workflowState;
  }
  if (update.workflowStep !== undefined) {
    updated.workflow_step = update.workflowStep;
  }
  if (update.leadId !== undefined) {
    updated.lead_id = update.leadId;
  }

  return updated;
}

/**
 * Detects visitor contact details from prompt text.
 */
export function extractVisitorContact(promptText: string): {
  name: string | null;
  phone: string | null;
  email: string | null;
} {
  let phone: string | null = null;
  let email: string | null = null;
  let name: string | null = null;

  // Phone extraction (10-14 digits, optional country code)
  const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?(?:(?:\d{5}[-.\s]?\d{5})|(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})|(?:\d{10,12}))/;
  const rawPhoneMatch = promptText.match(phoneRegex);
  if (rawPhoneMatch) {
    const digits = rawPhoneMatch[0].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 14 && digits !== "25000" && digits !== "20000" && digits !== "50000") {
      phone = rawPhoneMatch[0].trim();
    }
  }

  // Email extraction
  const emailMatch = promptText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    email = emailMatch[1].trim();
  }

  // Name extraction: "My name is John Doe", "I am Jane", "Name: Alex Smith"
  const namePatterns = [
    /(?:my name is|i am|this is|call me|name\s*[:=-])\s+([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?)/i,
    /(?:myself|it's|im)\s+([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?)/i,
  ];
  for (const pattern of namePatterns) {
    const match = promptText.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (isValidCustomerName(candidate)) {
        name = candidate;
        break;
      }
    }
  }

  return { name, phone, email };
}

function isValidCustomerName(candidate: string): boolean {
  if (!candidate || candidate.length < 2 || candidate.length > 50) return false;
  const lower = candidate.toLowerCase();
  const stopWords = [
    "python",
    "java",
    "course",
    "batch",
    "fee",
    "hotel",
    "room",
    "doctor",
    "hospital",
    "menu",
    "property",
    "pricing",
    "online",
    "offline",
    "morning",
    "evening",
    "none",
    "null",
    "admin",
    "test",
    "user",
    "guest",
    "today",
    "tomorrow",
    "yes",
    "no",
    "hi",
    "hello",
  ];
  if (stopWords.includes(lower)) return false;
  return /^[a-zA-Z\s.'-]+$/.test(candidate);
}

function isValidPhone(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 14;
}

function isValidEmail(candidate: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(candidate);
}
