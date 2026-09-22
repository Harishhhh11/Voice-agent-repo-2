import type {
  UniversalIntentType,
  UniversalIntentResult,
  UniversalKnowledgeModel,
  UniversalEntity,
} from "./types";

/**
 * Universal Intent Classification & Dynamic Entity Resolution System
 * Domain-agnostic semantic parser for multi-industry receptionists.
 */
export function classifyUniversalIntent(
  userText: string,
  knowledge: UniversalKnowledgeModel,
  previousEntities: UniversalEntity[] = []
): UniversalIntentResult {
  const text = (userText || "").trim();
  const lower = text.toLowerCase();
  const detectedLanguage = detectLanguage(text);

  // Check multi-intent (compound questions connected by "and", "also", "?")
  const subIntents: UniversalIntentResult["subIntents"] = [];

  // Escalation / Human Handoff
  if (
    lower.includes("human") ||
    lower.includes("manager") ||
    lower.includes("agent") ||
    lower.includes("real person") ||
    lower.includes("speak to someone") ||
    lower.includes("talk to someone") ||
    lower.includes("transfer me") ||
    lower.includes("operator") ||
    lower === "4" ||
    lower.includes("press 4")
  ) {
    return {
      primaryIntent: "HUMAN_HANDOFF",
      subIntents: [{ intent: "HUMAN_HANDOFF" }],
      confidence: 0.98,
      isActionable: true,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  // Greetings
  if (/^(hi|hello|hey|namaste|vanakkam|good morning|good afternoon|good evening|greetings)\b/i.test(lower) && text.length < 35) {
    return {
      primaryIntent: "GREETING",
      subIntents: [{ intent: "GREETING" }],
      confidence: 0.95,
      isActionable: false,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  // Calculations / Arithmetic
  if (
    /(?:total for|calculate|sum of|discount on|how much is \d+|what is \d+%\s*(?:of|discount)|add up|total cost of)/i.test(lower) ||
    /(\d+\s*[+*/-]\s*\d+)/.test(text)
  ) {
    return {
      primaryIntent: "CALCULATION",
      subIntents: [{ intent: "CALCULATION" }],
      confidence: 0.95,
      isActionable: false,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  // Document Requests (Brochure, Catalog, Menu, Price List, Syllabus)
  if (
    lower.includes("send me") ||
    lower.includes("send the") ||
    lower.includes("share the") ||
    lower.includes("download") ||
    lower.includes("brochure") ||
    lower.includes("catalog") ||
    lower.includes("menu") ||
    lower.includes("price list") ||
    lower.includes("syllabus") ||
    lower.includes("pamphlet")
  ) {
    return {
      primaryIntent: "DOCUMENT_REQUEST",
      subIntents: [{ intent: "DOCUMENT_REQUEST" }],
      confidence: 0.92,
      isActionable: true,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  // Cancellation / Modification (Transaction intent, not policy query)
  if (
    (lower.includes("cancel my") || lower.includes("i want to cancel") || lower === "cancel" || lower.includes("cancellation request")) &&
    !lower.includes("policy") &&
    !lower.includes("what is")
  ) {
    return {
      primaryIntent: "CANCELLATION",
      subIntents: [{ intent: "CANCELLATION" }],
      confidence: 0.95,
      isActionable: true,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  // Booking / Reservation / Appointment / Order
  if (
    lower.includes("book") ||
    lower.includes("reserve") ||
    lower.includes("schedule an appointment") ||
    lower.includes("make an appointment") ||
    lower.includes("join") ||
    lower.includes("enroll") ||
    lower.includes("order") ||
    lower.includes("buy") ||
    lower.includes("purchase") ||
    lower.includes("register for") ||
    lower.includes("interested in joining") ||
    lower.includes("want to join")
  ) {
    const isBooking = lower.includes("book") || lower.includes("reserve") || lower.includes("table") || lower.includes("room");
    const isAppointment = lower.includes("appointment") || lower.includes("doctor") || lower.includes("viewing") || lower.includes("consultation");
    const isEnroll = lower.includes("join") || lower.includes("enroll") || lower.includes("register");

    const intentType: UniversalIntentType = isBooking ? "BOOKING" : isAppointment ? "APPOINTMENT" : isEnroll ? "REGISTRATION" : "BOOKING";
    return {
      primaryIntent: intentType,
      subIntents: [{ intent: intentType }],
      confidence: 0.92,
      isActionable: true,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  // Price Queries
  const isPriceQuery =
    lower.includes("price") ||
    lower.includes("fee") ||
    lower.includes("cost") ||
    lower.includes("how much") ||
    lower.includes("charges") ||
    lower.includes("tariff") ||
    lower.includes("rate") ||
    lower.includes("entha") || // Telugu: how much
    lower.includes("kitna") || // Hindi: how much
    lower.includes("discount") ||
    lower.includes("offer");

  // Schedule / Timings / Availability Queries
  const isScheduleQuery =
    lower.includes("timing") ||
    lower.includes("timings") ||
    lower.includes("schedule") ||
    lower.includes("hours") ||
    lower.includes("when are you open") ||
    lower.includes("open") ||
    lower.includes("close") ||
    lower.includes("batch") ||
    lower.includes("batches") ||
    lower.includes("available on") ||
    lower.includes("available tomorrow") ||
    lower.includes("see patients on") ||
    lower.includes("slots");

  // Location Queries
  const isLocationQuery =
    lower.includes("where are you") ||
    lower.includes("location") ||
    lower.includes("address") ||
    lower.includes("directions") ||
    lower.includes("branch") ||
    lower.includes("office");

  // Policy Queries
  const isPolicyQuery =
    lower.includes("policy") ||
    lower.includes("rules") ||
    lower.includes("terms") ||
    lower.includes("refund") ||
    lower.includes("guarantee") ||
    lower.includes("check-in time") ||
    lower.includes("check-out time") ||
    lower.includes("dress code");

  // Search & Filter Queries (e.g. "under 50 lakhs", "properties in Gachibowli", "doctors available tomorrow", "rooms for 4")
  const isSearchFilterQuery =
    lower.includes("show me") ||
    lower.includes("find me") ||
    lower.includes("looking for") ||
    lower.includes("do you have") ||
    lower.includes("list of") ||
    lower.includes("which courses do you offer") ||
    lower.includes("what courses") ||
    lower.includes("what services") ||
    lower.includes("what do you offer") ||
    lower.includes("what do you have") ||
    lower.includes("under ") ||
    lower.includes("below ") ||
    lower.includes("near ");

  // Comparison Query
  const isComparisonQuery =
    lower.includes("compare") ||
    lower.includes("difference between") ||
    lower.includes("which one is better") ||
    lower.includes("versus") ||
    lower.includes(" vs ");

  // Recommendation Query
  const isRecommendationQuery =
    lower.includes("which one should i choose") ||
    lower.includes("which one is best") ||
    lower.includes("recommend") ||
    lower.includes("suggest");

  // Construct Multi-Intent if multiple flags triggered
  if (isPriceQuery && isScheduleQuery) {
    subIntents.push({ intent: "PRICE_QUERY" });
    subIntents.push({ intent: "SCHEDULE_QUERY" });
    return {
      primaryIntent: "MULTI_INTENT",
      subIntents,
      confidence: 0.9,
      isActionable: false,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  if (isComparisonQuery) {
    return {
      primaryIntent: "COMPARISON",
      subIntents: [{ intent: "COMPARISON" }],
      confidence: 0.9,
      isActionable: false,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  if (isRecommendationQuery) {
    return {
      primaryIntent: "RECOMMENDATION_REQUEST",
      subIntents: [{ intent: "RECOMMENDATION_REQUEST" }],
      confidence: 0.9,
      isActionable: false,
      requiresClarification: true, // Needs criteria first!
      detectedLanguage,
    };
  }

  if (isPriceQuery) {
    return {
      primaryIntent: "PRICE_QUERY",
      subIntents: [{ intent: "PRICE_QUERY" }],
      confidence: 0.92,
      isActionable: false,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  if (isScheduleQuery) {
    return {
      primaryIntent: "SCHEDULE_QUERY",
      subIntents: [{ intent: "SCHEDULE_QUERY" }],
      confidence: 0.92,
      isActionable: false,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  if (isLocationQuery) {
    return {
      primaryIntent: "LOCATION_QUERY",
      subIntents: [{ intent: "LOCATION_QUERY" }],
      confidence: 0.92,
      isActionable: false,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  if (isPolicyQuery) {
    return {
      primaryIntent: "POLICY_QUERY",
      subIntents: [{ intent: "POLICY_QUERY" }],
      confidence: 0.9,
      isActionable: false,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  if (isSearchFilterQuery) {
    return {
      primaryIntent: "SEARCH",
      subIntents: [{ intent: "SEARCH" }],
      confidence: 0.88,
      isActionable: false,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  // Check if referencing an existing entity directly
  const referencedEntity = resolveEntitiesFromUtterance(text, knowledge, previousEntities)[0];
  if (referencedEntity) {
    return {
      primaryIntent: "ENTITY_INFORMATION",
      subIntents: [{ intent: "ENTITY_INFORMATION", targetEntity: referencedEntity.name }],
      confidence: 0.85,
      isActionable: false,
      requiresClarification: false,
      detectedLanguage,
    };
  }

  return {
    primaryIntent: "GENERAL_INFORMATION",
    subIntents: [{ intent: "GENERAL_INFORMATION" }],
    confidence: 0.7,
    isActionable: false,
    requiresClarification: false,
    detectedLanguage,
  };
}

/**
 * Universal Dynamic Entity Resolution
 * Matches mentions of any entity from knowledge graph in user's prompt.
 */
export function resolveEntitiesFromUtterance(
  userText: string,
  knowledge: UniversalKnowledgeModel,
  previousEntities: UniversalEntity[] = []
): UniversalEntity[] {
  const text = (userText || "").trim();
  const lower = text.toLowerCase();
  const matchedEntities: { entity: UniversalEntity; matchIndex: number; score: number }[] = [];

  for (const entity of knowledge.entities) {
    const eNameLower = entity.name.toLowerCase();

    // 1. Exact full name match
    const exactIdx = lower.indexOf(eNameLower);
    if (exactIdx !== -1) {
      matchedEntities.push({ entity, matchIndex: exactIdx, score: 1.0 });
      continue;
    }

    // 2. Alias match
    let aliasMatched = false;
    for (const alias of entity.aliases) {
      const aIdx = lower.indexOf(alias.toLowerCase());
      if (aIdx !== -1) {
        matchedEntities.push({ entity, matchIndex: aIdx, score: 0.9 });
        aliasMatched = true;
        break;
      }
    }
    if (aliasMatched) continue;

    // 3. Significant token match (e.g. "python", "java", "ocean view", "dr kumar", "deluxe")
    const cleanTokens = eNameLower
      .replace(
        /\b(core|advance|advanced|course|programming|training|suite|room|dr|doctor|plan|package|dish|hotel|hospital|clinic|restaurant|bistro|company|technologies|specs|realty|urban|living|towers|overview|tariffs|brochure|tier|system|service|center|department)\b/gi,
        ""
      )
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    for (const tok of cleanTokens) {
      const tokIdx = lower.indexOf(tok);
      if (tokIdx !== -1) {
        matchedEntities.push({ entity, matchIndex: tokIdx, score: 0.8 });
        break;
      }
    }
  }

  // 4. Ordinal / Contextual reference resolution ("the first one", "second one", "that course", "that doctor")
  if (matchedEntities.length === 0 && previousEntities.length > 0) {
    if (
      lower === "1" ||
      lower.includes("1st") ||
      lower.includes("first one") ||
      lower.includes("first") ||
      lower.includes("former")
    ) {
      if (previousEntities[0]) {
        matchedEntities.push({ entity: previousEntities[0], matchIndex: 0, score: 0.85 });
      }
    } else if (
      lower === "2" ||
      lower.includes("2nd") ||
      lower.includes("second one") ||
      lower.includes("second") ||
      lower.includes("latter")
    ) {
      if (previousEntities[1]) {
        matchedEntities.push({ entity: previousEntities[1], matchIndex: 0, score: 0.85 });
      }
    } else if (lower.includes("that one") || lower.includes("this one") || lower.includes("the same")) {
      if (previousEntities[0]) {
        matchedEntities.push({ entity: previousEntities[0], matchIndex: 0, score: 0.75 });
      }
    }
  }

  // Deduplicate and sort by order of appearance in prompt
  const seenIds = new Set<string>();
  const results: UniversalEntity[] = [];

  matchedEntities.sort((a, b) => a.matchIndex - b.matchIndex);
  for (const item of matchedEntities) {
    if (!seenIds.has(item.entity.id)) {
      seenIds.add(item.entity.id);
      results.push(item.entity);
    }
  }

  return results;
}

/**
 * Universal Dynamic Filter Extraction
 * Extracts structured filters from free-form user query (e.g. price, location, size, date).
 */
export function extractUniversalFilters(userText: string): Record<string, string | number | boolean> {
  const filters: Record<string, string | number | boolean> = {};
  const lower = (userText || "").toLowerCase();

  // Price filters: "under 50 lakhs", "below $200", "under 10000"
  const underPriceMatch = lower.match(/(?:under|below|less than|max|maximum|budget of)\s*([₹$€£]?\s*[\d,]+(?:\s*(?:lakh|lakhs|k|m|million))?)/i);
  if (underPriceMatch) {
    const rawVal = underPriceMatch[1].replace(/[^0-9.a-z]/gi, "");
    let numVal = parseFloat(rawVal);
    if (rawVal.includes("lakh")) numVal = numVal * 100000;
    else if (rawVal.includes("k")) numVal = numVal * 1000;
    else if (rawVal.includes("m") || rawVal.includes("million")) numVal = numVal * 1000000;
    if (!isNaN(numVal)) {
      filters["max_price"] = numVal;
    }
  }

  // Location filter: "near Gachibowli", "in Ameerpet", "located in Banjara Hills"
  const locationMatch = lower.match(/(?:near|in|around|at)\s+([A-Za-z\s]{3,25})(?:\s+area|\s+branch)?(?=\s*(?:under|below|for|with|$))/i);
  if (locationMatch && !/^(the|our|this|that|all|any|both)$/i.test(locationMatch[1].trim())) {
    filters["location"] = locationMatch[1].trim();
  }

  // Bedroom / Capacity filter: "2BHK", "3BHK", "for 4 people", "table for 2"
  const bhkMatch = lower.match(/\b([1-5]\s*bhk)\b/i);
  if (bhkMatch) {
    filters["property_type"] = bhkMatch[1].toUpperCase();
  }

  const partyMatch = lower.match(/(?:for|party of|table for)\s*(\d{1,2})\s*(?:people|guests|persons)?/i);
  if (partyMatch) {
    filters["capacity"] = parseInt(partyMatch[1], 10);
  }

  // Temporal / Date filter: "tomorrow", "today", "Sunday", "Monday"
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const day of days) {
    if (lower.includes(day)) {
      filters["day_of_week"] = day.charAt(0).toUpperCase() + day.slice(1);
      break;
    }
  }
  if (lower.includes("tomorrow")) filters["date"] = "tomorrow";
  else if (lower.includes("today")) filters["date"] = "today";

  return filters;
}

function detectLanguage(text: string): "en" | "te" | "hi" {
  const lower = (text || "").toLowerCase();
  // Telugu indicators
  if (
    /[\u0C00-\u0C7F]/.test(text) ||
    lower.includes("cheppandi") ||
    lower.includes("entha") ||
    lower.includes("undi") ||
    lower.includes("untundi") ||
    lower.includes("gurinchi") ||
    lower.includes("meeru") ||
    lower.includes("mee ") ||
    lower.includes("kavali") ||
    lower.includes("dhanyavadalu")
  ) {
    return "te";
  }

  // Hindi indicators
  if (
    /[\u0900-\u097F]/.test(text) ||
    lower.includes("aapke") ||
    lower.includes("kaise") ||
    lower.includes("kya ") ||
    lower.includes("kya hai") ||
    lower.includes("kariye") ||
    lower.includes("bataiye") ||
    lower.includes("kitna") ||
    lower.includes("shukriya") ||
    lower.includes("dhanyavaad")
  ) {
    return "hi";
  }

  return "en";
}
