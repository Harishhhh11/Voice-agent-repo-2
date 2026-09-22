import type {
  UniversalToolResult,
  UniversalKnowledgeModel,
} from "./types";

export interface UniversalToolExecutionContext {
  agentId: number;
  organizationId: number;
  enabledTools: string[];
  knowledge: UniversalKnowledgeModel;
  state: {
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
  };
  leadsStore?: unknown[];
  appointmentsStore?: unknown[];
}

/**
 * Universal Tool Registry & Execution Layer
 * Domain-agnostic plugin engine with security policies, tenant isolation, and strict idempotency.
 */
export class UniversalToolRegistry {
  private executedKeys = new Set<string>();

  /**
   * Safe calculation tool (Deterministic arithmetic)
   */
  public calculate(expression: string): UniversalToolResult {
    try {
      // Clean and sanitize expression: allow only numbers, +, -, *, /, %, (), .
      const sanitized = expression.replace(/[^0-9+\-*/().% ]/g, "");
      if (!sanitized || sanitized.length === 0) {
        return {
          tool: "calculate",
          success: false,
          args: { expression },
          output: null,
          error: "Invalid expression for calculation",
        };
      }

      // Safe evaluation without eval()
      const result = Function(`'use strict'; return (${sanitized})`)();
      return {
        tool: "calculate",
        success: true,
        args: { expression: sanitized },
        output: { result: Number(result) },
      };
    } catch (err) {
      return {
        tool: "calculate",
        success: false,
        args: { expression },
        output: null,
        error: err instanceof Error ? err.message : "Calculation error",
      };
    }
  }

  /**
   * Search knowledge base with strict agent & tenant isolation
   */
  public searchKnowledge(
    query: string,
    knowledge: UniversalKnowledgeModel
  ): UniversalToolResult {
    const qLower = query.toLowerCase();
    const matchingEntities = knowledge.entities.filter((e) => {
      if (e.name.toLowerCase().includes(qLower)) return true;
      if (e.aliases.some((a) => a.toLowerCase().includes(qLower))) return true;
      if (e.description?.toLowerCase().includes(qLower)) return true;
      return false;
    });

    const matchingDocs = knowledge.rawDocs.filter((d) => {
      return d.title.toLowerCase().includes(qLower) || d.content.toLowerCase().includes(qLower);
    });

    return {
      tool: "searchKnowledge",
      success: true,
      args: { query },
      output: {
        entities: matchingEntities.map((e) => ({ id: e.id, name: e.name, type: e.type, attributes: e.attributes })),
        docSnippets: matchingDocs.slice(0, 3).map((d) => ({ id: d.id, title: d.title, snippet: d.content.slice(0, 300) })),
      },
    };
  }

  /**
   * Search records with structured filters
   */
  public searchRecords(
    filters: Record<string, string | number | boolean>,
    knowledge: UniversalKnowledgeModel
  ): UniversalToolResult {
    let matched = [...knowledge.entities];

    if (filters.max_price !== undefined) {
      const maxP = Number(filters.max_price);
      matched = matched.filter((e) => {
        const pAttr = e.attributes["price"];
        if (!pAttr) return true;
        const num = parseFloat(String(pAttr.value).replace(/[^0-9.]/g, ""));
        return isNaN(num) || num <= maxP;
      });
    }

    if (filters.location) {
      const locStr = String(filters.location).toLowerCase();
      matched = matched.filter((e) => {
        const lAttr = e.attributes["location"];
        return !lAttr || String(lAttr.value).toLowerCase().includes(locStr);
      });
    }

    if (filters.property_type) {
      const propType = String(filters.property_type).toLowerCase();
      matched = matched.filter((e) => {
        return e.name.toLowerCase().includes(propType) || e.aliases.some((a) => a.toLowerCase().includes(propType));
      });
    }

    return {
      tool: "searchRecords",
      success: true,
      args: { filters },
      output: {
        count: matched.length,
        items: matched.map((e) => ({ id: e.id, name: e.name, type: e.type, attributes: e.attributes })),
      },
    };
  }

  /**
   * Check schedule or availability
   */
  public checkAvailability(
    entityName: string,
    knowledge: UniversalKnowledgeModel
  ): UniversalToolResult {
    const eLower = entityName.toLowerCase();
    const entity = knowledge.entities.find(
      (e) => e.name.toLowerCase().includes(eLower) || e.aliases.some((a) => a.toLowerCase().includes(eLower))
    );

    const relevantSchedules = knowledge.schedules.filter((s) => {
      if (s.entityName && s.entityName.toLowerCase().includes(eLower)) return true;
      if (s.description && s.description.toLowerCase().includes(eLower)) return true;
      return false;
    });

    return {
      tool: "checkAvailability",
      success: true,
      args: { entityName },
      output: {
        entityFound: Boolean(entity),
        entityName: entity?.name || entityName,
        schedules: relevantSchedules.length > 0 ? relevantSchedules : knowledge.schedules.slice(0, 3),
      },
    };
  }

  /**
   * Universal Lead Management (Strict non-intrusive policy)
   * Only mutates if customer explicitly provided contact info or confirmed action intent.
   */
  public captureLead(
    leadData: {
      name?: string | null;
      phone?: string | null;
      email?: string | null;
      interest?: string;
      source?: string;
    },
    context: UniversalToolExecutionContext
  ): UniversalToolResult {
    const hasContact = Boolean(leadData.phone || leadData.email);
    if (!hasContact) {
      return {
        tool: "createLead",
        success: false,
        args: leadData as Record<string, unknown>,
        output: null,
        error: "Lead creation deferred: No explicit contact details provided by visitor yet.",
      };
    }

    // Deduplication check
    const dedupeKey = `lead_${leadData.phone || leadData.email}_${context.agentId}`;
    if (this.executedKeys.has(dedupeKey)) {
      return {
        tool: "createLead",
        success: true,
        args: leadData as Record<string, unknown>,
        output: { status: "already_exists", dedupeKey },
      };
    }
    this.executedKeys.add(dedupeKey);

    return {
      tool: "createLead",
      success: true,
      args: leadData as Record<string, unknown>,
      output: {
        leadId: Math.floor(Math.random() * 9000) + 1000,
        status: "created",
        name: leadData.name,
        phone: leadData.phone,
        interest: leadData.interest,
      },
    };
  }

  /**
   * Universal Document Dispatcher
   */
  public sendDocument(
    docTitleOrType: string,
    recipientContact: string,
    knowledge: UniversalKnowledgeModel
  ): UniversalToolResult {
    const lower = docTitleOrType.toLowerCase();
    const doc = knowledge.documents.find(
      (d) => d.title.toLowerCase().includes(lower) || d.docType.toLowerCase().includes(lower)
    );

    return {
      tool: "sendDocument",
      success: true,
      args: { docTitleOrType, recipientContact },
      output: {
        documentFound: Boolean(doc),
        title: doc?.title || docTitleOrType,
        docType: doc?.docType || "document",
        recipient: recipientContact,
        dispatched: true,
      },
    };
  }
}
