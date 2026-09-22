import type {
  UniversalKnowledgeModel,
  UniversalEntity,
  UniversalEntityType,
  UniversalPolicy,
  UniversalSchedule,
  UniversalPricing,
  UniversalDocumentItem,
  UniversalFact,
  UniversalOrganizationInfo,
} from "./types";

export interface RawInputDocument {
  id: number;
  title: string;
  content: string;
  source?: string;
  category?: string;
  updated_at?: string;
}

/**
 * Universal Knowledge Ingestion & Entity Discovery Engine
 * Normalizes ANY unstructured or structured business text into a unified Universal Knowledge Model.
 * Domain-agnostic: Works across Hotels, Hospitals, Real Estate, Restaurants, SaaS, Education, Gyms, Law Firms, etc.
 */
export function ingestUniversalKnowledge(
  rawDocs: RawInputDocument[],
  agentContext?: { name?: string; industry?: string; company_name?: string }
): UniversalKnowledgeModel {
  const model: UniversalKnowledgeModel = {
    organization: {
      name: agentContext?.company_name || "Host Organization",
      industry: agentContext?.industry,
    },
    entities: [],
    facts: [],
    relationships: [],
    policies: [],
    schedules: [],
    pricing: [],
    documents: [],
    actions: [],
    constraints: [],
    rawDocs: rawDocs || [],
  };

  if (!rawDocs || rawDocs.length === 0) {
    return model;
  }

  // 1. Extract Organization Metadata across all docs
  for (const doc of rawDocs) {
    const text = doc.content || "";
    extractOrganizationDetails(text, model.organization);
  }

  // 2. Discover Entities, Pricing, Schedules, and Policies per document
  for (const doc of rawDocs) {
    // A. Detect Policies
    extractPolicies(doc, model.policies);

    // B. Detect Documents/Brochures/Menus
    extractDocuments(doc, model.documents);

    // C. Discover Primary Entities in this document
    const discoveredEntities = extractEntitiesFromDocument(doc);
    for (const ent of discoveredEntities) {
      // Deduplicate or merge with existing entity
      const existing = model.entities.find(
        (e) => e.name.toLowerCase() === ent.name.toLowerCase() || e.aliases.some((a) => ent.aliases.includes(a))
      );
      if (existing) {
        // Merge attributes and aliases
        existing.aliases = Array.from(new Set([...existing.aliases, ...ent.aliases]));
        existing.attributes = { ...existing.attributes, ...ent.attributes };
        if (!existing.description && ent.description) existing.description = ent.description;
      } else {
        model.entities.push(ent);
      }
    }

    // D. Discover Pricing
    extractPricing(doc, model.pricing);

    // E. Discover Schedules & Timings
    extractSchedules(doc, model.schedules);

    // F. Discover Key Business Facts
    extractFacts(doc, model.facts);
  }

  // 3. Synthesize Cross-Entity Relationships
  synthesizeRelationships(model);

  // 4. Populate dynamic available actions based on discovered entities & schemas
  synthesizeAvailableActions(model);

  return model;
}

function extractOrganizationDetails(text: string, org: UniversalOrganizationInfo): void {
  const compMatch =
    text.match(/(?:Company|Organization|Business|Hospital|Hotel|Restaurant|Agency|Firm|Institute)\s*[:=-]\s*([^\r\n]+)/i) ||
    text.match(/(?:About|Welcome to)\s+([A-Z][A-Za-z0-9\s&,.'-]{3,40})/);
  if (compMatch && compMatch[1]?.trim() && !org.name.includes(compMatch[1].trim())) {
    const candidate = compMatch[1].trim().replace(/\b(Information|Details|Overview|Manual|Guide)\b/gi, "").trim();
    if (candidate.length > 2 && !/^(the|our|host|unknown)$/i.test(candidate)) {
      if (org.name === "Host Organization") {
        org.name = candidate;
      }
    }
  }

  const phoneMatch = text.match(/(?:Phone|Contact|Helpline|Tel|Call|WhatsApp)\s*[:=-]\s*([+0-9\s-]{10,20})/i);
  if (phoneMatch && phoneMatch[1] && !org.phone) {
    org.phone = phoneMatch[1].trim();
  }

  const emailMatch = text.match(/(?:Email|Mail|Contact Us)\s*[:=-]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch && emailMatch[1] && !org.email) {
    org.email = emailMatch[1].trim();
  }

  const addressMatch = text.match(/(?:Address|Location|Headquarters|Clinic Location|Property Address)\s*[:=-]\s*([^\r\n]+)/i);
  if (addressMatch && addressMatch[1] && !org.address) {
    org.address = addressMatch[1].trim();
  }

  const hoursMatch = text.match(/(?:Business Hours|Working Hours|Timings|Operating Hours|Open Hours)\s*[:=-]\s*([^\r\n]+)/i);
  if (hoursMatch && hoursMatch[1] && !org.businessHours) {
    org.businessHours = hoursMatch[1].trim();
  }

  const emergMatch = text.match(/(?:Emergency Hotline|Emergency Contact|Trauma Unit|Emergency|Helpline)\s*[:=-]?\s*([+0-9\s-]{8,25})/i);
  if (emergMatch && emergMatch[1] && !org.emergencyContact) {
    org.emergencyContact = emergMatch[1].trim();
  }
}

function extractPolicies(doc: RawInputDocument, policies: UniversalPolicy[]): void {
  const text = doc.content || "";
  const lines = text.split(/\r?\n/);
  let currentCategory: UniversalPolicy["category"] = "general";
  let collectingRules: string[] = [];
  let policyName = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isBullet = line.startsWith("•") || line.startsWith("-") || line.startsWith("*") || /^\d+[.)]\s/.test(line);

    if (isBullet) {
      const cleanRule = line.replace(/^(?:•|-|\*|\d+[.)])\s*/, "").trim();
      if (cleanRule.length > 5) {
        collectingRules.push(cleanRule);
      }
      continue;
    }

    if (/(?:cancellation policy|cancelation policy|cancellation)/i.test(line)) {
      if (collectingRules.length > 0) {
        policies.push({
          id: `pol_${policies.length + 1}`,
          name: policyName || "Policy",
          category: currentCategory,
          rules: [...collectingRules],
          sourceDocId: doc.id,
        });
        collectingRules = [];
      }
      currentCategory = "cancellation";
      policyName = "Cancellation Policy";
    } else if (/(?:refund policy|refunds|money back)/i.test(line)) {
      if (collectingRules.length > 0) {
        policies.push({
          id: `pol_${policies.length + 1}`,
          name: policyName || "Policy",
          category: currentCategory,
          rules: [...collectingRules],
          sourceDocId: doc.id,
        });
        collectingRules = [];
      }
      currentCategory = "refund";
      policyName = "Refund Policy";
    } else if (/(?:booking policy|reservation policy|terms of booking)/i.test(line)) {
      if (collectingRules.length > 0) {
        policies.push({
          id: `pol_${policies.length + 1}`,
          name: policyName || "Policy",
          category: currentCategory,
          rules: [...collectingRules],
          sourceDocId: doc.id,
        });
        collectingRules = [];
      }
      currentCategory = "booking";
      policyName = "Booking Policy";
    } else if (/(?:eligibility|prerequisites|requirements|admission criteria)/i.test(line)) {
      if (collectingRules.length > 0) {
        policies.push({
          id: `pol_${policies.length + 1}`,
          name: policyName || "Policy",
          category: currentCategory,
          rules: [...collectingRules],
          sourceDocId: doc.id,
        });
        collectingRules = [];
      }
      currentCategory = "prerequisite";
      policyName = "Prerequisites & Eligibility Policy";
    } else if (/(?:trial|free trial|guarantee)/i.test(line)) {
      if (collectingRules.length > 0) {
        policies.push({
          id: `pol_${policies.length + 1}`,
          name: policyName || "Policy",
          category: currentCategory,
          rules: [...collectingRules],
          sourceDocId: doc.id,
        });
        collectingRules = [];
      }
      currentCategory = "general";
      policyName = "Trial Policy";
    }
  }

  if (collectingRules.length > 0) {
    policies.push({
      id: `pol_${policies.length + 1}`,
      name: policyName || `${doc.title} Policy`,
      category: currentCategory,
      rules: collectingRules,
      sourceDocId: doc.id,
    });
  }
}

function extractDocuments(doc: RawInputDocument, documents: UniversalDocumentItem[]): void {
  const title = doc.title || "";
  const lowerTitle = title.toLowerCase();

  let docType: UniversalDocumentItem["docType"] = "general";
  if (lowerTitle.includes("brochure") || lowerTitle.includes("pamphlet")) docType = "brochure";
  else if (lowerTitle.includes("menu")) docType = "menu";
  else if (lowerTitle.includes("catalog") || lowerTitle.includes("catalogue")) docType = "catalog";
  else if (lowerTitle.includes("price") || lowerTitle.includes("tariff") || lowerTitle.includes("fee")) docType = "price_list";
  else if (lowerTitle.includes("syllabus") || lowerTitle.includes("curriculum")) docType = "syllabus";
  else if (lowerTitle.includes("guide") || lowerTitle.includes("handbook")) docType = "guide";
  else if (lowerTitle.includes("form") || lowerTitle.includes("application")) docType = "form";
  else if (lowerTitle.includes("policy") || lowerTitle.includes("terms")) docType = "policy";

  documents.push({
    id: `doc_${doc.id}`,
    title: doc.title,
    docType,
    description: doc.content.slice(0, 160).replace(/\r?\n/g, " "),
    sourceDocId: doc.id,
  });
}

function extractEntitiesFromDocument(doc: RawInputDocument): UniversalEntity[] {
  const entities: UniversalEntity[] = [];
  const text = doc.content || "";
  const lines = text.split(/\r?\n/);

  // 1. Direct explicit entity patterns (e.g. "Room Type:", "Doctor Name:", "Property:", "Product:", "Dish:", "Course Name:")
  const entityHeadingRegex =
    /(?:Entity|Product|Service|Course Name|Course|Room Type|Room|Doctor|Department|Property|Plan|Package|Dish|Menu Item|Treatment|Membership|Specialty)\s*[:=-]\s*([^\r\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = entityHeadingRegex.exec(text)) !== null) {
    const rawName = match[1]?.trim();
    if (rawName && isValidEntityName(rawName)) {
      const type = inferEntityType(match[0], rawName);
      const entity = createUniversalEntity(rawName, type, doc);
      populateEntityAttributes(entity, text);
      entities.push(entity);
    }
  }

  // 2. Multi-entity list extraction (bullet points of rooms, doctors, properties, menu items, tiers)
  for (const line of lines) {
    const trimmed = line.trim();
    // Patterns like: "• Deluxe Ocean View Suite: $350 / night" or "• Dr. Priya Nair: ..."
    const listMatch = trimmed.match(/^(?:•|-|\*)\s*([A-Z0-9][A-Za-z0-9\s&()'-]{2,50})\s*[:–—-]\s*(.+)/);
    if (listMatch) {
      const itemTitle = listMatch[1].trim();
      const itemDetails = listMatch[2].trim();
      if (isValidEntityName(itemTitle)) {
        const type = inferEntityType(trimmed, itemTitle);
        const itemEntity = createUniversalEntity(itemTitle, type, doc);
        itemEntity.description = itemDetails;
        populateEntityAttributes(itemEntity, itemDetails);
        entities.push(itemEntity);

        // Check if itemDetails embeds a specific doctor or specialist (e.g. "Dr. Priya Nair" or "Dr. Rajesh Sharma")
        const docSubMatch = itemDetails.match(/\b(Dr\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
        if (docSubMatch) {
          const docName = docSubMatch[1].trim();
          const docEntity = createUniversalEntity(docName, "doctor", doc);
          docEntity.description = `${itemTitle} specialist. ${itemDetails}`;
          populateEntityAttributes(docEntity, itemDetails);
          entities.push(docEntity);
        }
      }
    }
  }

  // 3. Fallback to document title ONLY if no specific sub-entities found and title is not generic
  if (entities.length === 0) {
    const cleanTitle = doc.title
      .replace(/\.(txt|pdf|docx|csv|json)$/i, "")
      .replace(/^(doc|info|manual|guide|details|catalog)-?/i, "")
      .trim();

    const isGenericDocTitle = /(?:overview|tariffs|brochure|price sheet|specs|menu & dining|platform specs)/i.test(cleanTitle);
    if (!isGenericDocTitle && cleanTitle.length > 2 && isValidEntityName(cleanTitle)) {
      const type = inferEntityType(doc.title + " " + text.slice(0, 300), cleanTitle);
      const entity = createUniversalEntity(cleanTitle, type, doc);
      populateEntityAttributes(entity, text);
      entities.push(entity);
    }
  }

  return entities;
}

function isValidEntityName(name: string): boolean {
  const lower = name.toLowerCase();
  if (name.length < 2 || name.length > 70) return false;
  if (/^(the|our|this|that|none|null|undefined|overview|general|summary|details|introduction|table of contents)$/i.test(lower)) {
    return false;
  }
  if (/^(company|institute|hospital|hotel|restaurant|organization)\s*(details|information|profile)?$/i.test(lower)) {
    return false;
  }
  return true;
}

function inferEntityType(context: string, name: string): UniversalEntityType {
  const combined = (context + " " + name).toLowerCase();
  if (/\b(room|suite|deluxe|villa|cottage|presidential|penthouse|dorm|bed)\b/.test(combined)) return "room";
  if (/\b(dr\.|doctor|physician|surgeon|consultant|specialist|cardiologist|neurologist|pediatrician|orthopedic)\b/.test(combined)) return "doctor";
  if (/\b(department|cardiology|neurology|orthopedics|radiology|emergency|oncology|icu|opd)\b/.test(combined)) return "department";
  if (/\b(property|bhk|apartment|villa|sqft|plot|gated community|flat|duplex)\b/.test(combined)) return "property";
  if (/\b(dish|starter|soup|curry|biryani|pizza|burger|dessert|beverage|pasta|wine|appetizer|platter)\b/.test(combined)) return "menu_item";
  if (/\b(course|programming|bootcamp|certification|syllabus|curriculum|training)\b/.test(combined)) return "course";
  if (/\b(plan|tier|pro|enterprise|basic|starter|premium|subscription|saas)\b/.test(combined)) return "plan";
  if (/\b(membership|pass|session|training|massage|spa|treatment|consultation)\b/.test(combined)) return "service";
  if (/\b(product|device|kit|tool|item|model|hardware)\b/.test(combined)) return "product";
  return "service";
}

function createUniversalEntity(name: string, type: UniversalEntityType, doc: RawInputDocument): UniversalEntity {
  const cleanName = name.replace(/^•\s*/, "").trim();
  const aliases = generateEntityAliases(cleanName);

  return {
    id: `ent_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    name: cleanName,
    type,
    aliases,
    attributes: {},
    relationships: [],
    sourceDocId: doc.id,
    sourceDocTitle: doc.title,
    isActive: true,
  };
}

function generateEntityAliases(name: string): string[] {
  const aliases = new Set<string>();
  aliases.add(name.toLowerCase());

  // Remove common prefixes
  const strippedPrefix = name.replace(/^(core|advanced|basic|dr\.|doctor|the|luxury|deluxe|executive)\s+/i, "").trim();
  if (strippedPrefix && strippedPrefix.length >= 3) {
    aliases.add(strippedPrefix.toLowerCase());
  }

  // Remove common suffixes
  const strippedSuffix = name.replace(/\s+(programming|course|training|department|specialist|suite|room|plan|bhk)$/i, "").trim();
  if (strippedSuffix && strippedSuffix.length >= 3) {
    aliases.add(strippedSuffix.toLowerCase());
  }

  // Acronyms if multi-word (e.g. "Full Stack Web Development" -> "FSWD", "Core Java" -> "CJ")
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const acronym = words.map((w) => w[0]).join("").toLowerCase();
    if (acronym.length >= 2) aliases.add(acronym);
  }

  return Array.from(aliases);
}

function populateEntityAttributes(entity: UniversalEntity, text: string): void {
  // Price / Fee (including Lakhs, Crores, per night/month)
  const priceMatch =
    text.match(/(?:Price|Fee|Cost|Tariff|Tuition|Rate|Pricing|Consultation Fee)\s*[:=-]\s*([₹$€£]?\s*[\d,]+(?:\s*(?:Lakhs?|Crores?|Cr|k|m|million))?(?:\s*(?:\/|-|\s+per\s+)\s*(?:month|night|year|hr|hour|person|seat|day|total))?)/i) ||
    text.match(/([₹$€£]\s*[\d,]+(?:\s*(?:Lakhs?|Crores?|Cr|k|m))?(?:\s*(?:\/|\s+per\s+)\s*(?:month|night|year|hr|hour|person|seat|day))?)/i);
  if (priceMatch && priceMatch[1]) {
    const rawVal = priceMatch[1].trim();
    entity.attributes["price"] = {
      key: "price",
      label: "Price / Fee",
      value: rawVal,
      valueType: "currency",
      isFilterable: true,
    };
  }

  // Duration / Timing / Hours
  const durMatch = text.match(/(?:Duration|Stay Duration|Length|Term)\s*[:=-]\s*([^\r\n]+)/i);
  if (durMatch && durMatch[1]) {
    entity.attributes["duration"] = {
      key: "duration",
      label: "Duration",
      value: durMatch[1].trim(),
      valueType: "string",
    };
  }

  // Location / Address / Center
  const locMatch = text.match(/(?:Location|Address|Campus|Venue|Area|Neighborhood)\s*[:=-]\s*([^\r\n]+)/i);
  if (locMatch && locMatch[1]) {
    entity.attributes["location"] = {
      key: "location",
      label: "Location",
      value: locMatch[1].trim(),
      valueType: "string",
      isFilterable: true,
    };
  }

  // Availability / Slots / Capacity
  const capMatch = text.match(/(?:Capacity|Guests|Max Guests|Party Size|Bedrooms|Seats|Units)\s*[:=-]\s*([^\r\n]+)/i);
  if (capMatch && capMatch[1]) {
    entity.attributes["capacity"] = {
      key: "capacity",
      label: "Capacity",
      value: capMatch[1].trim(),
      valueType: "string",
      isFilterable: true,
    };
  }

  // Modes / Formats (e.g. Online, Classroom, Dine-in, Takeout, Telemedicine, In-Person)
  const modes: string[] = [];
  if (/online|remote|live interactive|virtual/i.test(text)) modes.push("Online");
  if (/classroom|in-person|offline|on-site|at clinic|dine-in/i.test(text)) modes.push("In-Person / On-Site");
  if (modes.length > 0) {
    entity.attributes["modes"] = {
      key: "modes",
      label: "Available Formats",
      value: modes,
      valueType: "list",
      isFilterable: true,
    };
  }

  // Features / Highlights / Amenities
  const featuresMatch = text.match(/(?:Amenities|Features|Inclusions|Facilities|Highlights|Topics Covered)\s*[:=-]\s*([^\r\n]+)/i);
  if (featuresMatch && featuresMatch[1]) {
    entity.attributes["features"] = {
      key: "features",
      label: "Features & Inclusions",
      value: featuresMatch[1].trim(),
      valueType: "string",
    };
  }
}

function extractPricing(doc: RawInputDocument, pricingList: UniversalPricing[]): void {
  const text = doc.content || "";
  const priceRegex =
    /(?:(?:Price|Fee|Cost|Rate|Tariff|Tuition|Plan Fee)\s*[:=-]\s*|starts at\s+|for\s+)([₹$€£]\s*[\d,]+(?:\.\d{2})?)\s*(?:\/|\s+per\s+)?(night|month|year|hr|hour|person|seat|day|consultation|property)?/gi;

  let match: RegExpExecArray | null;
  while ((match = priceRegex.exec(text)) !== null) {
    const rawAmountStr = match[1].replace(/[^0-9.]/g, "");
    const amount = parseFloat(rawAmountStr);
    if (!isNaN(amount) && amount > 0) {
      const currencySymbol = match[1].match(/[₹$€£]/)?.[0] || "₹";
      const billingPeriodRaw = (match[2] || "").toLowerCase();
      let billingPeriod: UniversalPricing["billingPeriod"] = "one-time";
      if (billingPeriodRaw.includes("night")) billingPeriod = "per-night";
      else if (billingPeriodRaw.includes("month")) billingPeriod = "monthly";
      else if (billingPeriodRaw.includes("year")) billingPeriod = "yearly";
      else if (billingPeriodRaw.includes("hr") || billingPeriodRaw.includes("hour")) billingPeriod = "hourly";
      else if (billingPeriodRaw.includes("person") || billingPeriodRaw.includes("seat")) billingPeriod = "per-person";

      pricingList.push({
        id: `prc_${pricingList.length + 1}`,
        amount,
        currency: currencySymbol,
        billingPeriod,
        formattedDisplay: `${currencySymbol}${amount.toLocaleString()}${billingPeriod !== "one-time" ? ` / ${billingPeriod.replace("per-", "")}` : ""}`,
        sourceDocId: doc.id,
      });
    }
  }
}

function extractSchedules(doc: RawInputDocument, schedules: UniversalSchedule[]): void {
  const text = doc.content || "";

  // Check explicit timing schedules
  // Patterns like: "Morning Batch: 9:00 AM – 11:00 AM IST" or "Consultation Hours: 10:00 AM – 2:00 PM"
  const scheduleRegex =
    /(?:Timings?|Hours?|Schedule|Batch Timings?|Check-in|Check-out|Opening Hours?)\s*[:=-]\s*([^\r\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = scheduleRegex.exec(text)) !== null) {
    const rawVal = match[1]?.trim();
    if (rawVal && rawVal.length >= 3 && !/^(fee|inr|pricing|cost|tuition)/i.test(rawVal)) {
      schedules.push({
        id: `sch_${schedules.length + 1}`,
        description: rawVal,
        sourceDocId: doc.id,
      });
    }
  }

  // Morning / Evening split
  const morningMatch = text.match(/(?:Morning(?: Batch| Slot| Hours)?)\s*[:=-]\s*([^\r\n]+)/i);
  if (morningMatch && morningMatch[1]) {
    schedules.push({
      id: `sch_${schedules.length + 1}`,
      description: `Morning: ${morningMatch[1].trim()}`,
      sourceDocId: doc.id,
    });
  }

  const eveningMatch = text.match(/(?:Evening(?: Batch| Slot| Hours)?)\s*[:=-]\s*([^\r\n]+)/i);
  if (eveningMatch && eveningMatch[1]) {
    schedules.push({
      id: `sch_${schedules.length + 1}`,
      description: `Evening: ${eveningMatch[1].trim()}`,
      sourceDocId: doc.id,
    });
  }
}

function extractFacts(doc: RawInputDocument, facts: UniversalFact[]): void {
  const text = doc.content || "";
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const kvMatch = line.match(/^([A-Za-z0-9\s&_-]{3,35})\s*[:=-]\s*(.+)$/);
    if (kvMatch) {
      const subject = kvMatch[1].trim();
      const object = kvMatch[2].trim();
      if (object.length >= 2 && !/^(the|our|none|null|nil)$/i.test(object)) {
        facts.push({
          id: `fct_${facts.length + 1}`,
          subject,
          predicate: "has_value",
          object,
          source: doc.title,
          docId: doc.id,
          confidence: 0.95,
        });
      }
    }
  }
}

function synthesizeRelationships(model: UniversalKnowledgeModel): void {
  for (const entity of model.entities) {
    // Relationship: Entity has price
    const priceAttr = entity.attributes["price"];
    if (priceAttr) {
      model.relationships.push({
        sourceEntityId: entity.id,
        targetEntityId: `price_${entity.id}`,
        relationType: "has_price",
        metadata: { display: priceAttr.value },
      });
    }

    // Relationship: Entity available at location
    const locAttr = entity.attributes["location"];
    if (locAttr) {
      model.relationships.push({
        sourceEntityId: entity.id,
        targetEntityId: `loc_${String(locAttr.value).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        relationType: "available_at",
        metadata: { location: locAttr.value },
      });
    }

    // Relationship: Doctor specializes in Department
    if (entity.type === "doctor") {
      const deptMatch = entity.name.match(/\(([^)]+)\)/);
      if (deptMatch) {
        model.relationships.push({
          sourceEntityId: entity.id,
          targetEntityId: `dept_${deptMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          relationType: "specializes_in",
          metadata: { department: deptMatch[1] },
        });
      }
    }
  }
}

function synthesizeAvailableActions(model: UniversalKnowledgeModel): void {
  // Always support universal discovery actions
  model.actions.push(
    { name: "searchKnowledge", description: "Search verified knowledge across all documents", requiredFields: ["query"] },
    { name: "getEntity", description: "Get canonical entity details and attributes", requiredFields: ["entityName"] },
    { name: "calculate", description: "Perform exact arithmetic, pricing totals, and discounts", requiredFields: ["expression"] }
  );

  // If rooms/tables/appointments/services exist, support reservation/booking
  const hasBookables = model.entities.some((e) => ["room", "doctor", "property", "service", "menu_item"].includes(e.type));
  if (hasBookables) {
    model.actions.push({
      name: "createBooking",
      description: "Reserve a room, table, consultation, viewing, or service slot",
      requiredFields: ["customer_name", "customer_phone", "entity_name"],
    });
    model.actions.push({
      name: "createAppointment",
      description: "Schedule a formal appointment with staff, doctor, or agent",
      requiredFields: ["customer_name", "customer_phone", "date_time"],
    });
  }

  // Lead qualification
  model.actions.push({
    name: "createLead",
    description: "Capture verified customer interest and contact details",
    requiredFields: ["customer_name", "customer_phone"],
  });

  // Document dispatch
  if (model.documents.length > 0) {
    model.actions.push({
      name: "sendDocument",
      description: "Send official brochure, catalog, menu, or price list to customer",
      requiredFields: ["document_title", "recipient_contact"],
    });
  }
}
