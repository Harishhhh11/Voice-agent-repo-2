/**
 * ResponsePlanner Engine
 * 
 * Prepares raw text from LLM / Agent knowledge into natural, human-sounding
 * conversational speech for Telugu and Telugu-English (Tanglish) telephony TTS.
 * 
 * Responsibilities:
 * - Shorten multi-paragraph output into 1-2 conversational sentences for turn-taking
 * - Strip markdown, bullet points, headers, URLs, emojis
 * - Expand currency (₹4,000 -> నాలుగు వేల రూపాయలు)
 * - Expand numbers & durations (30 days -> ముప్పై రోజులు)
 * - Expand batch timings (10 AM -> ఉదయం పది గంటలకు)
 * - Apply custom pronunciation dictionary
 * - Contextual conversational fillers ("అవును", "సరే", "తప్పకుండా", "ఓకే", "అర్థమైంది")
 * - Preserve natural Telugu-English code-mixing without forced translation
 */

export interface PronunciationRule {
  id: string;
  source: string;
  replacement: string;
  category: "brand" | "technical" | "currency" | "timing" | "location";
  language: "te" | "en" | "all";
  isActive: boolean;
}

export interface PlannerOptions {
  isTelugu?: boolean;
  phoneMode?: boolean;
  maxSentences?: number;
  emotionalContext?: "greeting" | "information" | "pricing" | "confusion" | "frustration" | "confirmation" | "farewell" | "neutral";
  customPronunciations?: PronunciationRule[];
}

export const DEFAULT_PRONUNCIATION_RULES: PronunciationRule[] = [
  { id: "pr-1", source: "Maruthi Technologies", replacement: "మారుతి టెక్నాలజీస్", category: "brand", language: "all", isActive: true },
  { id: "pr-2", source: "Python", replacement: "పైథాన్", category: "technical", language: "all", isActive: true },
  { id: "pr-3", source: "Java", replacement: "జావా", category: "technical", language: "all", isActive: true },
  { id: "pr-4", source: "Core Python", replacement: "కోర్ పైథాన్", category: "technical", language: "all", isActive: true },
  { id: "pr-5", source: "Core Java", replacement: "కోర్ జావా", category: "technical", language: "all", isActive: true },
  { id: "pr-6", source: "Ameerpet", replacement: "అమీర్‌పేట", category: "location", language: "all", isActive: true },
  { id: "pr-7", source: "Hyderabad", replacement: "హైదరాబాద్", category: "location", language: "all", isActive: true },
  { id: "pr-8", source: "Online batch", replacement: "ఆన్‌లైన్ బ్యాచ్", category: "technical", language: "all", isActive: true },
  { id: "pr-9", source: "Classroom batch", replacement: "క్లాస్‌రూమ్ బ్యాచ్", category: "technical", language: "all", isActive: true },
  { id: "pr-10", source: "Full Stack", replacement: "ఫుల్ స్టాక్", category: "technical", language: "all", isActive: true },
  { id: "pr-11", source: "Placement Assistance", replacement: "ప్లేస్‌మెంట్ అసిస్టెన్స్", category: "technical", language: "all", isActive: true },
  { id: "pr-12", source: "AI / ML", replacement: "ఏఐ మరియు ఎంఎల్", category: "technical", language: "all", isActive: true },
  { id: "pr-13", source: "API", replacement: "ఏపీఐ", category: "technical", language: "all", isActive: true },
  { id: "pr-14", source: "SQL", replacement: "సీక్వెల్", category: "technical", language: "all", isActive: true },
  { id: "pr-15", source: "UI / UX", replacement: "యూఐ యూఎక్స్", category: "technical", language: "all", isActive: true },
];

export class ResponsePlanner {
  /**
   * Universal Telugu speech text normalizer for natural conversational tone across all sentences
   */
  public static normalizeTeluguSpeechText(text: string): string {
    let s = text.trim();
    const hasTelugu = /[\u0C00-\u0C7F]/.test(s);

    // 1. Strip Markdown, Lists, Links, HTML tags, Emojis
    s = s.replace(/^[•\-*#>\d.]+\s*/gm, "");
    s = s.replace(/\*\*(.*?)\*\*/g, "$1");
    s = s.replace(/\*(.*?)\*/g, "$1");
    s = s.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
    s = s.replace(/<[^>]*>/g, "");
    s = s.replace(/[\u{1F300}-\u{1FAFF}]/gu, "");
    s = s.replace(/[`_~|]/g, " ");

    // 2. Comprehensive Currency Expansion (₹ amounts)
    s = s.replace(/₹\s*1[,.]?000(\/-)?/gi, hasTelugu ? "ఒక వెయ్యి రూపాయలు" : "one thousand rupees");
    s = s.replace(/₹\s*2[,.]?000(\/-)?/gi, hasTelugu ? "రెండు వేల రూపాయలు" : "two thousand rupees");
    s = s.replace(/₹\s*3[,.]?000(\/-)?/gi, hasTelugu ? "మూడు వేల రూపాయలు" : "three thousand rupees");
    s = s.replace(/₹\s*4[,.]?000(\/-)?/gi, hasTelugu ? "నాలుగు వేల రూపాయలు" : "four thousand rupees");
    s = s.replace(/₹\s*5[,.]?000(\/-)?/gi, hasTelugu ? "ఐదు వేల రూపాయలు" : "five thousand rupees");
    s = s.replace(/₹\s*6[,.]?000(\/-)?/gi, hasTelugu ? "ఆరు వేల రూపాయలు" : "six thousand rupees");
    s = s.replace(/₹\s*7[,.]?000(\/-)?/gi, hasTelugu ? "ఏడు వేల రూపాయలు" : "seven thousand rupees");
    s = s.replace(/₹\s*8[,.]?000(\/-)?/gi, hasTelugu ? "ఎనిమిది వేల రూపాయలు" : "eight thousand rupees");
    s = s.replace(/₹\s*9[,.]?000(\/-)?/gi, hasTelugu ? "తొమ్మిది వేల రూపాయలు" : "nine thousand rupees");
    s = s.replace(/₹\s*10[,.]?000(\/-)?/gi, hasTelugu ? "పది వేల రూపాయలు" : "ten thousand rupees");
    s = s.replace(/₹\s*12[,.]?000(\/-)?/gi, hasTelugu ? "పన్నెండు వేల రూపాయలు" : "twelve thousand rupees");
    s = s.replace(/₹\s*15[,.]?000(\/-)?/gi, hasTelugu ? "పదిహేను వేల రూపాయలు" : "fifteen thousand rupees");
    s = s.replace(/₹\s*20[,.]?000(\/-)?/gi, hasTelugu ? "ఇరవై వేల రూపాయలు" : "twenty thousand rupees");
    s = s.replace(/₹\s*25[,.]?000(\/-)?/gi, hasTelugu ? "ఇరవై ఐదు వేల రూపాయలు" : "twenty-five thousand rupees");
    s = s.replace(/₹\s*30[,.]?000(\/-)?/gi, hasTelugu ? "ముప్పై వేల రూపాయలు" : "thirty thousand rupees");
    s = s.replace(/₹\s*40[,.]?000(\/-)?/gi, hasTelugu ? "నలభై వేల రూపాయలు" : "forty thousand rupees");
    s = s.replace(/₹\s*50[,.]?000(\/-)?/gi, hasTelugu ? "యాభై వేల రూపాయలు" : "fifty thousand rupees");
    s = s.replace(/₹\s*1[,.]?00[,.]?000(\/-)?/gi, hasTelugu ? "ఒక లక్ష రూపాయలు" : "one lakh rupees");

    s = s.replace(/₹\s*([0-9,]+)/g, (_, amt) => {
      const cleanNum = amt.replace(/,/g, "");
      const num = parseInt(cleanNum, 10);
      if (isNaN(num)) return hasTelugu ? `${cleanNum} రూపాయలు` : `${cleanNum} rupees`;
      if (num >= 1000) {
        const th = Math.floor(num / 1000);
        const rem = num % 1000;
        const thWord = th === 1 ? "ఒక వేల" : th === 2 ? "రెండు వేల" : th === 3 ? "మూడు వేల" : th === 4 ? "నాలుగు వేల" : th === 5 ? "ఐదు వేల" : th === 6 ? "ఆరు వేల" : th === 7 ? "ఏడు వేల" : th === 8 ? "ఎనిమిది వేల" : th === 9 ? "తొమ్మిది వేల" : `${th} వేల`;
        if (rem >= 500) {
          return hasTelugu ? `${thWord} ఐదు వందల రూపాయలు` : `${num} rupees`;
        }
        return hasTelugu ? `${thWord} రూపాయలు` : `${num} rupees`;
      }
      return hasTelugu ? `${num} రూపాయలు` : `${num} rupees`;
    });

    // 3. Comprehensive Durations & Numbers
    s = s.replace(/\b10\s*(days|Days|రోజులు)\b/gi, hasTelugu ? "పది రోజులు" : "10 days");
    s = s.replace(/\b15\s*(days|Days|రోజులు)\b/gi, hasTelugu ? "పదిహేను రోజులు" : "15 days");
    s = s.replace(/\b20\s*(days|Days|రోజులు)\b/gi, hasTelugu ? "ఇరవై రోజులు" : "20 days");
    s = s.replace(/\b25\s*(days|Days|రోజులు)\b/gi, hasTelugu ? "ఇరవై ఐదు రోజులు" : "25 days");
    s = s.replace(/\b30\s*(days|Days|రోజులు)\b/gi, hasTelugu ? "ముప్పై రోజులు" : "30 days");
    s = s.replace(/\b40\s*(days|Days|రోజులు)\b/gi, hasTelugu ? "నలభై రోజులు" : "40 days");
    s = s.replace(/\b45\s*(days|Days|రోజులు)\b/gi, hasTelugu ? "నలభై ఐదు రోజులు" : "45 days");
    s = s.replace(/\b50\s*(days|Days|రోజులు)\b/gi, hasTelugu ? "యాభై రోజులు" : "50 days");
    s = s.replace(/\b60\s*(days|Days|రోజులు)\b/gi, hasTelugu ? "అరవై రోజులు" : "60 days");
    s = s.replace(/\b90\s*(days|Days|రోజులు)\b/gi, hasTelugu ? "తొంభై రోజులు" : "90 days");
    s = s.replace(/\b1\s*(month|Month|నెల)\b/gi, hasTelugu ? "ఒక నెల" : "1 month");
    s = s.replace(/\b2\s*(months|Months|నెలలు)\b/gi, hasTelugu ? "రెండు నెలలు" : "2 months");
    s = s.replace(/\b3\s*(months|Months|నెలలు)\b/gi, hasTelugu ? "మూడు నెలలు" : "3 months");
    s = s.replace(/\b6\s*(months|Months|నెలలు)\b/gi, hasTelugu ? "ఆరు నెలలు" : "6 months");

    // 4. Expand Batch Timings
    s = s.replace(/8\s*AM\s*to\s*10\s*AM/gi, hasTelugu ? "ఉదయం ఎనిమిది నుండి పది గంటలు" : "8 AM to 10 AM");
    s = s.replace(/6\s*PM\s*to\s*8\s*PM/gi, hasTelugu ? "సాయంత్రం ఆరు నుండి ఎనిమిది గంటలు" : "6 PM to 8 PM");
    s = s.replace(/10\s*AM\s*to\s*12\s*PM/gi, hasTelugu ? "ఉదయం పది నుండి పన్నెండు గంటలు" : "10 AM to 12 PM");
    s = s.replace(/10:00\s*AM/gi, hasTelugu ? "ఉదయం పది గంటలకు" : "10:00 AM");
    s = s.replace(/10\s*AM/gi, hasTelugu ? "ఉదయం పది గంటలకు" : "10 AM");
    s = s.replace(/6:00\s*PM/gi, hasTelugu ? "సాయంత్రం ఆరు గంటలకు" : "6:00 PM");
    s = s.replace(/6\s*PM/gi, hasTelugu ? "సాయంత్రం ఆరు గంటలకు" : "6 PM");
    s = s.replace(/8:00\s*AM/gi, hasTelugu ? "ఉదయం ఎనిమిది గంటలకు" : "8:00 AM");
    s = s.replace(/8\s*AM/gi, hasTelugu ? "ఉదయం ఎనిమిది గంటలకు" : "8 AM");

    return s;
  }

  /**
   * Plans and transforms raw text into telephony-ready speech
   */
  public static planForVoice(rawText: string, options: PlannerOptions = {}): {
    spokenText: string;
    normalizedText: string;
    sentenceCount: number;
    estimatedDurationMs: number;
    emotionalContext: string;
  } {
    if (!rawText) {
      return {
        spokenText: "నమస్కారం అండి!",
        normalizedText: "నమస్కారం అండి!",
        sentenceCount: 1,
        estimatedDurationMs: 1200,
        emotionalContext: "greeting",
      };
    }

    let s = rawText.trim();
    const hasTelugu = /[\u0C00-\u0C7F]/.test(s) || options.isTelugu === true;

    // Apply universal speech text normalizer
    s = ResponsePlanner.normalizeTeluguSpeechText(s);

    // 5. Apply Pronunciation dictionary rules
    const rules = options.customPronunciations && options.customPronunciations.length > 0
      ? options.customPronunciations
      : DEFAULT_PRONUNCIATION_RULES;

    for (const rule of rules) {
      if (!rule.isActive) continue;
      const escaped = rule.source.replace(/[+.*^$()[\]{}|\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      s = s.replace(regex, rule.replacement);
    }

    // 6. Smooth conversational punctuation
    s = s.replace(/[\n\r]+/g, ". ");
    s = s.replace(/;+/g, ",");
    s = s.replace(/:/g, ",");
    s = s.replace(/\s{2,}/g, " ").trim();

    // 7. Limit sentence length for natural turn taking (Max 2 sentences by default for phone mode)
    const maxSentences = options.maxSentences || (options.phoneMode ? 2 : 3);
    const sentences = s.split(/(?<=[.?!।])\s+/).filter(Boolean);
    
    let trimmedSentences = sentences;
    if (sentences.length > maxSentences) {
      trimmedSentences = sentences.slice(0, maxSentences);
    }

    let spoken = trimmedSentences.join(" ").trim();

    // 8. Attach subtle conversational acknowledgement if appropriate
    if (options.emotionalContext === "greeting" && !spoken.includes("నమస్కారం") && hasTelugu) {
      spoken = "నమస్కారం అండి! " + spoken;
    } else if (options.emotionalContext === "frustration" && hasTelugu && !spoken.includes("సహాయం")) {
      spoken = "ఖచ్చితంగా అండి, నేను మీకు సహాయం చేస్తాను. " + spoken;
    } else if (options.emotionalContext === "confirmation" && hasTelugu) {
      spoken = "తప్పకుండా అండి! " + spoken;
    }

    // Calculate approximate duration: average ~15 characters per second for natural Telugu cadence
    const estimatedDurationMs = Math.round((spoken.length / 15) * 1000) + 400;

    return {
      spokenText: spoken,
      normalizedText: s,
      sentenceCount: trimmedSentences.length,
      estimatedDurationMs,
      emotionalContext: options.emotionalContext || "neutral",
    };
  }
}
