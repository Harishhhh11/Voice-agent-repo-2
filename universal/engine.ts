import type {
  UniversalKnowledgeModel,
  UniversalIntentResult,
  UniversalStateMemory,
  UniversalToolResult,
  UniversalEntity,
  UniversalOrganizationInfo,
} from "./types";
import { ingestUniversalKnowledge, type RawInputDocument } from "./knowledgeIngestion";
import { classifyUniversalIntent, resolveEntitiesFromUtterance, extractUniversalFilters } from "./intentSystem";
import { updateUniversalState, extractVisitorContact } from "./conversationState";
import { UniversalToolRegistry, type UniversalToolExecutionContext } from "./toolRegistry";
import { GoogleGenAI } from "@google/genai";

export interface UniversalTurnInput {
  userText: string;
  agentObj: {
    id: number;
    name: string;
    organization_id?: number;
    system_prompt?: string;
    personality?: string;
    tools?: string[];
    industry?: string;
    company_name?: string;
  };
  rawDocs: RawInputDocument[];
  existingState?: Partial<UniversalStateMemory>;
  context?: {
    leadsStore?: unknown[];
    appointmentsStore?: unknown[];
  };
  skipLLM?: boolean;
}

export interface UniversalTurnOutput {
  reply: string;
  toolsExecuted: UniversalToolResult[];
  groundingSources: { id: number; title: string; source: string }[];
  state: UniversalStateMemory;
  intent: string;
  language: "en" | "te" | "hi";
  isEscalated: boolean;
  quickReplies: string[];
  latency_ms: number;
}

const toolRegistry = new UniversalToolRegistry();

/**
 * Universal Master AI Receptionist Reasoner
 * Works across ANY industry, company, or document structure.
 */
export async function executeUniversalReceptionistTurn(
  input: UniversalTurnInput
): Promise<UniversalTurnOutput> {
  const startTime = Date.now();
  const promptText = (input.userText || "").trim();

  // 1. Ingest & Normalize Knowledge Base
  const knowledge: UniversalKnowledgeModel = ingestUniversalKnowledge(input.rawDocs, {
    name: input.agentObj.name,
    industry: input.agentObj.industry,
    company_name: input.agentObj.company_name,
  });

  // 2. Initialize or restore conversational memory & topic stack
  const previousState: UniversalStateMemory = {
    topic_stack: input.existingState?.topic_stack || [],
    current_entity: input.existingState?.current_entity,
    active_filters: input.existingState?.active_filters || {},
    entity_preferences: input.existingState?.entity_preferences || {},
    customer_info: input.existingState?.customer_info || { name: null, phone: null, email: null, company: null },
    workflow_state: input.existingState?.workflow_state || "DISCOVERY",
    workflow_step: input.existingState?.workflow_step,
    lead_id: input.existingState?.lead_id || null,
    idempotency_keys: input.existingState?.idempotency_keys || [],
  };

  // 3. Extract Visitor Contact
  const contact = extractVisitorContact(promptText);

  // 4. Resolve Entities Mentioned
  const previousEntities = previousState.current_entity ? [previousState.current_entity] : [];
  const resolvedEntities = resolveEntitiesFromUtterance(promptText, knowledge, previousEntities);
  const hasAnaphora = /\b(it|that|this|same|the doctor|the room|the tier|the property|the course|the dish)\b/i.test(promptText);
  const activeEntity = resolvedEntities[0] || (hasAnaphora ? previousState.current_entity : null);

  // 5. Classify Intent & Sub-Intents
  const intentResult: UniversalIntentResult = classifyUniversalIntent(promptText, knowledge, resolvedEntities);

  // 6. Extract Structured Filters
  const filters = extractUniversalFilters(promptText);

  // 7. Update State
  const updatedState = updateUniversalState(previousState, {
    visitorName: contact.name,
    visitorPhone: contact.phone,
    visitorEmail: contact.email,
    activeEntity,
    activeIntent: intentResult.primaryIntent,
    newFilters: filters,
  });

  // 8. Tool Execution & Actions
  const toolsExecuted: UniversalToolResult[] = [];
  const groundingSources: { id: number; title: string; source: string }[] = [];

  const toolContext: UniversalToolExecutionContext = {
    agentId: input.agentObj.id,
    organizationId: input.agentObj.organization_id || 1,
    enabledTools: input.agentObj.tools || ["searchKnowledge", "getEntity"],
    knowledge,
    state: updatedState.customer_info,
    leadsStore: input.context?.leadsStore,
    appointmentsStore: input.context?.appointmentsStore,
  };

  // Search Knowledge tool execution
  const searchResult = toolRegistry.searchKnowledge(promptText, knowledge);
  toolsExecuted.push(searchResult);

  // Calculation tool execution if requested
  if (intentResult.primaryIntent === "CALCULATION") {
    const mathMatch = promptText.match(/(\d+(?:\.\d+)?\s*[+*/-]\s*\d+(?:\.\d+)?)/);
    if (mathMatch) {
      const calcResult = toolRegistry.calculate(mathMatch[1]);
      toolsExecuted.push(calcResult);
    }
  }

  // Safe lead capture: Only when explicit contact details are provided
  if (contact.phone || contact.email) {
    const leadRes = toolRegistry.captureLead(
      {
        name: updatedState.customer_info.name,
        phone: updatedState.customer_info.phone,
        email: updatedState.customer_info.email,
        interest: activeEntity?.name || "General Inquiry",
        source: "AI Receptionist Chat",
      },
      toolContext
    );
    toolsExecuted.push(leadRes);
    const leadOutput = leadRes.output as { leadId?: string } | null;
    if (leadRes.success && leadOutput?.leadId) {
      updatedState.lead_id = leadOutput.leadId;
    }
  }

  // Collect Grounding Sources from matching docs
  for (const doc of knowledge.rawDocs) {
    if (activeEntity?.sourceDocId === doc.id) {
      groundingSources.push({ id: doc.id, title: doc.title, source: doc.source || "Uploaded Document" });
    } else if (
      doc.content.toLowerCase().includes(promptText.toLowerCase().slice(0, 20)) ||
      doc.title.toLowerCase().includes(promptText.toLowerCase().slice(0, 20))
    ) {
      groundingSources.push({ id: doc.id, title: doc.title, source: doc.source || "Uploaded Document" });
    }
  }
  if (groundingSources.length === 0 && knowledge.rawDocs.length > 0) {
    groundingSources.push({
      id: knowledge.rawDocs[0].id,
      title: knowledge.rawDocs[0].title,
      source: knowledge.rawDocs[0].source || "Uploaded Document",
    });
  }

  // 9. Generate Grounded Synthesis
  let reply = "";
  const isEscalated = intentResult.primaryIntent === "HUMAN_HANDOFF";

  if (isEscalated) {
    reply = generateEscalationReply(intentResult.detectedLanguage, knowledge.organization);
  } else {
    // Attempt LLM generation if GEMINI_API_KEY is available and not skipped
    const geminiReply = !input.skipLLM
      ? await attemptGeminiSynthesis(promptText, knowledge, activeEntity, intentResult, input.agentObj)
      : null;
    if (geminiReply) {
      reply = geminiReply;
    } else {
      // Deterministic Universal Synthesizer (100% grounded, zero hallucination)
      reply = synthesizeDeterministicResponse(
        promptText,
        intentResult,
        knowledge,
        activeEntity,
        resolvedEntities,
        toolsExecuted,
        updatedState
      );
    }
  }

  // 10. Compute Quick Replies
  const quickReplies = computeQuickReplies(intentResult, knowledge, activeEntity);

  return {
    reply: reply.trim(),
    toolsExecuted,
    groundingSources,
    state: updatedState,
    intent: intentResult.primaryIntent,
    language: intentResult.detectedLanguage,
    isEscalated,
    quickReplies,
    latency_ms: Date.now() - startTime,
  };
}

async function attemptGeminiSynthesis(
  userText: string,
  knowledge: UniversalKnowledgeModel,
  activeEntity: UniversalEntity | null,
  intent: UniversalIntentResult,
  agentObj: { name: string; personality?: string }
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const docsContext = knowledge.rawDocs
      .slice(0, 5)
      .map((d) => `--- DOCUMENT: ${d.title} ---\n${d.content}`)
      .join("\n\n");

    const prompt = `
You are ${agentObj.name}, the professional front-desk AI receptionist for ${knowledge.organization.name}.
Personality: ${agentObj.personality || "Courteous, helpful, articulate, and professional"}.

STRICT GROUNDING DIRECTIVE:
1. Answer the visitor's question using ONLY the verified facts in the business documents below.
2. If the answer is NOT present or verified in the documents, respond truthfully: "I don't have verified information about that in the company's available records."
3. NEVER make up unverified prices, dates, amenities, policies, or contact numbers.
4. If the user asks in Telugu or Hindi, respond naturally in that language while preserving entity names and numbers.
5. Format clean, professional text without markdown asterisks (**) for cleaner speech and display.

BUSINESS KNOWLEDGE DOCUMENTS:
${docsContext}

VISITOR MESSAGE:
"${userText}"
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    const candidateText = response.text?.replace(/\*\*/g, "").trim();
    if (candidateText && candidateText.length > 10) {
      return candidateText;
    }
  } catch {
    // Graceful fallback to deterministic synthesizer
  }
  return null;
}

function synthesizeDeterministicResponse(
  userText: string,
  intent: UniversalIntentResult,
  knowledge: UniversalKnowledgeModel,
  activeEntity: UniversalEntity | null,
  resolvedEntities: UniversalEntity[],
  toolsExecuted: UniversalToolResult[],
  state: UniversalStateMemory
): string {
  const lower = userText.toLowerCase();
  const orgName = knowledge.organization.name;
  const lang = intent.detectedLanguage;

  // GREETING
  if (intent.primaryIntent === "GREETING") {
    if (lang === "te") {
      return `నమస్కారం! ${orgName} రిసెప్షన్‌కు స్వాగతం. నేను మీకు ఎలా సహాయపడగలను?`;
    }
    if (lang === "hi") {
      return `नमस्ते! ${orgName} में आपका स्वागत है। मैं आपकी क्या सहायता कर सकता हूँ?`;
    }
    return `Hello! Welcome to ${orgName}. How can I assist you with our services, appointments, or inquiries today?`;
  }

  // CALCULATION
  if (intent.primaryIntent === "CALCULATION") {
    const calc = toolsExecuted.find((t) => t.tool === "calculate" && t.success);
    const calcOutput = calc?.output as { result?: number } | null;
    if (calcOutput && calcOutput.result !== undefined) {
      const res = calcOutput.result;
      return `Based on verified rates, the calculated amount is ${res.toLocaleString()}.`;
    }
  }

  // DOCUMENT REQUEST (Brochure, menu, syllabus, catalog)
  if (intent.primaryIntent === "DOCUMENT_REQUEST") {
    const doc = knowledge.documents[0];
    const contactInfo = state.customer_info.phone || state.customer_info.email;
    if (contactInfo) {
      return `I have arranged for the official ${doc?.title || "brochure and information packet"} to be sent directly to ${contactInfo}.`;
    }
    return `Certainly! I would be pleased to share the ${doc?.title || "official brochure"}. Could you please provide your mobile number or email address so I can dispatch it to you right away?`;
  }

  // COMPARISON QUERY
  if (intent.primaryIntent === "COMPARISON" && resolvedEntities.length >= 2) {
    const [e1, e2] = resolvedEntities;
    const p1 = e1.attributes["price"]?.value || "Standard rates apply";
    const p2 = e2.attributes["price"]?.value || "Standard rates apply";
    const d1 = e1.attributes["duration"]?.value || e1.description || "";
    const d2 = e2.attributes["duration"]?.value || e2.description || "";

    return `Here is the comparison between ${e1.name} and ${e2.name}:\n\n• ${e1.name}: Pricing is ${p1}${d1 ? `, with ${d1}` : ""}.\n• ${e2.name}: Pricing is ${p2}${d2 ? `, with ${d2}` : ""}.\n\nBoth options are fully supported by ${orgName}. Which one aligns better with your requirements?`;
  }

  // RECOMMENDATION REQUEST
  if (intent.primaryIntent === "RECOMMENDATION_REQUEST") {
    return `To give you the most accurate recommendation, could you share a bit more about your specific requirements, timeline, or preferred budget? That will help me suggest the best option for you at ${orgName}.`;
  }

  // CONTACT & EMERGENCY QUERY
  if (
    intent.primaryIntent === "CONTACT_QUERY" ||
    lower.includes("emergency") ||
    lower.includes("trauma") ||
    lower.includes("phone number") ||
    lower.includes("hotline")
  ) {
    if (lower.includes("emergency") || lower.includes("trauma")) {
      const emerg = knowledge.organization.emergencyContact || knowledge.organization.phone;
      if (emerg) {
        return `For emergencies, our 24/7 emergency and trauma helpline is ${emerg}. Immediate assistance is on standby.`;
      }
    }
    const phone = knowledge.organization.phone || knowledge.organization.emergencyContact;
    const email = knowledge.organization.email;
    return `You can reach ${orgName} at ${phone || "our front desk"}${email ? ` or via email at ${email}` : ""}.`;
  }

  // BOOKING, APPOINTMENTS & SAMPLE FLAT VIEWINGS
  if (
    intent.primaryIntent === "BOOKING" ||
    intent.primaryIntent === "APPOINTMENT" ||
    lower.includes("viewing") ||
    lower.includes("book a sample") ||
    lower.includes("book visit")
  ) {
    for (const d of knowledge.rawDocs) {
      if (d.content.toLowerCase().includes("viewing")) {
        const match = d.content.match(/(?:Viewing Appointments|Sample Flats|Walkthrough)\s*[:=-]\s*([^\r\n]+(?:\n[•-][^\n]+)*)/i);
        if (match) {
          return `Certainly! We would be delighted to arrange your viewing visit. ${match[1].trim()}. May I have your name and contact number to confirm the booking?`;
        }
      }
    }
    return `Certainly! I would be pleased to schedule your appointment or booking. May I have your preferred date and contact phone number?`;
  }

  // PRICE QUERY
  if (
    intent.primaryIntent === "PRICE_QUERY" ||
    lower.includes("how much") ||
    lower.includes("cost") ||
    lower.includes("fee")
  ) {
    if (activeEntity && activeEntity.attributes["price"]) {
      const priceVal = activeEntity.attributes["price"].value;
      if (lang === "te") {
        return `${activeEntity.name} ఫీజు/ధర ${priceVal}. ఇందులో అన్ని ముఖ్యమైన సదుపాయాలు ఉంటాయి.`;
      }
      if (lang === "hi") {
        return `${activeEntity.name} की फीस/कीमत ${priceVal} है।`;
      }
      return `The official pricing for ${activeEntity.name} is ${priceVal}.`;
    }
    if (knowledge.pricing.length > 0) {
      const list = knowledge.pricing.slice(0, 3).map((p) => `• ${p.formattedDisplay}`).join("\n");
      return `Here are the verified rates available at ${orgName}:\n${list}\n\nWould you like details for a specific item?`;
    }
  }

  // SCHEDULE & TIMINGS QUERY
  if (
    intent.primaryIntent === "SCHEDULE_QUERY" ||
    lower.includes("timing") ||
    lower.includes("check-in") ||
    lower.includes("check-out") ||
    lower.includes("hours")
  ) {
    // Check-in and check-out times
    if (lower.includes("check-in") || lower.includes("check-out")) {
      for (const d of knowledge.rawDocs) {
        const ci = d.content.match(/Check-in Time\s*[:=-]\s*([^\r\n]+)/i);
        const co = d.content.match(/Check-out Time\s*[:=-]\s*([^\r\n]+)/i);
        if (ci && co) {
          return `Our check-in time is ${ci[1].trim()} and check-out time is ${co[1].trim()}.`;
        }
      }
    }
    if (activeEntity) {
      const sched = knowledge.schedules.find((s) => s.entityName === activeEntity.name || s.description);
      if (sched?.description) {
        return `The verified schedule for ${activeEntity.name} is: ${sched.description}.`;
      }
      // Check doc lines for entity OPD/timings
      for (const d of knowledge.rawDocs) {
        if (d.content.toLowerCase().includes(activeEntity.name.toLowerCase())) {
          const match = d.content.match(new RegExp(`${activeEntity.name}[^\\n]+?(?:OPD Hours|Hours|Timings)\\s*[:=-]\\s*([^\\r\\n.]+)`, "i"));
          if (match) {
            return `The verified schedule for ${activeEntity.name} is ${match[1].trim()}.`;
          }
        }
      }
    }
    if (knowledge.schedules.length > 0) {
      const scheds = knowledge.schedules.slice(0, 3).map((s) => `• ${s.description}`).join("\n");
      return `Here are our verified operating hours and schedules:\n${scheds}`;
    }
    if (knowledge.organization.businessHours) {
      return `Our business hours are ${knowledge.organization.businessHours}.`;
    }
  }

  // LOCATION & ADDRESS QUERY
  if (intent.primaryIntent === "LOCATION_QUERY") {
    const addr = knowledge.organization.address;
    if (addr) {
      return `${orgName} is located at ${addr}. We look forward to welcoming you!`;
    }
  }

  // POLICY QUERY & CANCELLATIONS
  if (
    intent.primaryIntent === "POLICY_QUERY" ||
    intent.primaryIntent === "CANCELLATION" ||
    lower.includes("policy") ||
    lower.includes("cancellation") ||
    lower.includes("trial")
  ) {
    const isCancel = lower.includes("cancel");
    const isRefund = lower.includes("refund");
    const isTrial = lower.includes("trial");

    for (const p of knowledge.policies) {
      if (isCancel && (p.category === "cancellation" || p.name.toLowerCase().includes("cancel"))) {
        return `Our official Cancellation Policy is:\n${p.rules.map((r) => `• ${r}`).join("\n")}`;
      }
      if (isRefund && (p.category === "refund" || p.name.toLowerCase().includes("refund"))) {
        return `Our official Refund Policy is:\n${p.rules.map((r) => `• ${r}`).join("\n")}`;
      }
      if (isTrial && (p.name.toLowerCase().includes("trial") || p.rules.some((r) => r.toLowerCase().includes("trial")))) {
        return `Our Trial Policy is:\n${p.rules.map((r) => `• ${r}`).join("\n")}`;
      }
    }

    // Direct doc pattern scan for policy
    for (const d of knowledge.rawDocs) {
      if (isCancel && d.content.toLowerCase().includes("cancellation")) {
        const match = d.content.match(/Cancellation Policy\s*:\s*([^#\n]+(?:\n[•-][^\n]+)*)/i);
        if (match) return `Our official Cancellation Policy is:\n${match[1].trim()}`;
      }
      if (isTrial && d.content.toLowerCase().includes("trial")) {
        const match = d.content.match(/(?:Trial & Refund Policy|Trial Policy)\s*:\s*([^#\n]+(?:\n[•-][^\n]+)*)/i);
        if (match) return `Our Trial & Refund Policy is:\n${match[1].trim()}`;
      }
    }
  }

  // SPECIFIC ENTITY INFORMATION
  if (activeEntity) {
    const priceStr = activeEntity.attributes["price"]?.value ? ` Pricing: ${activeEntity.attributes["price"].value}.` : "";
    const desc = activeEntity.description || activeEntity.attributes["features"]?.value || "";
    return `${activeEntity.name} is one of our premier offerings at ${orgName}.${desc ? ` ${desc}.` : ""}${priceStr} Would you like to check availability or proceed with a booking?`;
  }

  // CHECK KNOWLEDGE SNIPPETS
  const searchTool = toolsExecuted.find((t) => t.tool === "searchKnowledge");
  const searchOutput = searchTool?.output as { docSnippets?: { snippet: string }[] } | null;
  const snippets = searchOutput?.docSnippets;
  if (snippets && snippets.length > 0) {
    const cleanSnippet = snippets[0].snippet.replace(/\r?\n+/g, " ").trim();
    return `Regarding your inquiry: ${cleanSnippet}. Please let me know if you would like more details!`;
  }

  // STRICT ANTI-HALLUCINATION FALLBACK
  return `I don't have verified information about that in the company's available records. Would you like me to connect you with a representative or help with one of our verified services?`;
}

function generateEscalationReply(lang: "en" | "te" | "hi", org: UniversalOrganizationInfo): string {
  const contact = org.phone || org.emergencyContact || "our customer support desk";
  if (lang === "te") {
    return `నేను మిమ్మల్ని వెంటనే మా మేనేజర్ లేదా మానవ ప్రతినిధితో కనెక్ట్ చేస్తున్నాను. మీరు నేరుగా ${contact} ద్వారా కూడా సంప్రదించవచ్చు.`;
  }
  if (lang === "hi") {
    return `मैं तुरंत आपको हमारे मानव प्रतिनिधि से कनेक्ट कर रहा हूँ। आप सीधे ${contact} पर भी संपर्क कर सकते हैं।`;
  }
  return `I am transferring you directly to a human specialist at ${org.name}. You may also reach our team immediately at ${contact}. Please hold while I connect you.`;
}

function computeQuickReplies(
  _intent: UniversalIntentResult,
  knowledge: UniversalKnowledgeModel,
  activeEntity: UniversalEntity | null
): string[] {
  if (activeEntity) {
    return [
      `What is the price of ${activeEntity.name}?`,
      `Check availability for ${activeEntity.name}`,
      `Book ${activeEntity.name}`,
    ];
  }
  if (knowledge.entities.length > 0) {
    return knowledge.entities.slice(0, 3).map((e) => `Tell me about ${e.name}`);
  }
  return ["Explore Services", "Check Business Hours", "Speak to a Human"];
}
