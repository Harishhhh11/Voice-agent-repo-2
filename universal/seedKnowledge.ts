export interface IndustrySeedTemplate {
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
  documents: {
    id: number;
    title: string;
    category: string;
    content: string;
  }[];
}

export const MULTI_INDUSTRY_SEEDS: IndustrySeedTemplate[] = [
  // 1. HOSPITALITY / HOTEL
  {
    agent: {
      id: 972,
      name: "Elena — Grand Horizon Hotel & Suites",
      industry: "Hospitality & Hotels",
      business_type: "Hotel",
      personality: "Warm, refined, hospitable, and attentive",
      system_prompt:
        "You are Elena, the concierge and front-desk AI receptionist for Grand Horizon Luxury Hotel & Suites. Answer guest inquiries about room types, check-in policies, dining, and pool amenities accurately from verified hotel documents. Never fabricate room rates or policies.",
      voice_enabled: true,
      voice_name: "Aoede",
      greeting_message:
        "Welcome to Grand Horizon Luxury Hotel & Suites. I'm Elena, your front desk receptionist. How may I assist with your stay, room reservations, or hotel amenities today?",
      tools: ["searchKnowledge", "getEntity", "checkAvailability", "createBooking", "calculate"],
    },
    documents: [
      {
        id: 901,
        title: "Grand Horizon Hotel Overview & Room Tariffs",
        category: "Accommodations",
        content: `
Company: Grand Horizon Luxury Hotel & Suites
Location: 45 Seaside Boulevard, Marina District
Phone: +1 (555) 742-8800
Email: reservations@grandhorizonhotel.com
Check-in Time: 3:00 PM
Check-out Time: 11:00 AM

Room Types & Pricing:
• Deluxe Ocean View Suite: $350 / night. Capacity: Up to 3 guests. Features king-sized bed, private ocean-view balcony, marble bathroom, complimentary breakfast.
• Executive City Suite: $240 / night. Capacity: Up to 2 guests. Features king bed, panoramic skyline view, dedicated work desk, high-speed fiber Wi-Fi.
• Presidential Penthouse: $850 / night. Capacity: Up to 6 guests. Features 2 master bedrooms, private terrace jacuzzi, personal butler service, complimentary airport limousine transfer.

Amenities:
• Heated Infinity Pool: Open daily from 6:00 AM to 10:00 PM.
• Horizon Spa & Wellness Center: Treatments available from 9:00 AM to 8:00 PM.
• Valet Parking: Available 24/7 for $30/night.
• Breakfast Buffet: Served daily at The Glasshouse from 6:30 AM to 10:30 AM ($35 for external guests, complimentary for suite bookings).

Cancellation Policy:
• Free cancellation up to 48 hours prior to check-in date.
• Cancellations within 48 hours incur a 1-night room charge.
• Non-refundable promotional rates cannot be canceled or modified.
        `.trim(),
      },
    ],
  },

  // 2. HEALTHCARE / HOSPITAL
  {
    agent: {
      id: 973,
      name: "Dr. Aisha — MetroCare Multi-Speciality Hospital",
      industry: "Healthcare & Hospitals",
      business_type: "Hospital",
      personality: "Empathetic, clear, medically accurate, and reassuring",
      system_prompt:
        "You are Dr. Aisha, the clinical receptionist AI for MetroCare Multi-Speciality Hospital. Help patients find specialists, check OPD timings, department locations, and emergency contacts. Always prioritize patient safety and direct true emergencies to the 24/7 emergency trauma unit.",
      voice_enabled: true,
      voice_name: "Puck",
      greeting_message:
        "Hello, welcome to MetroCare Multi-Speciality Hospital. I am Aisha. How can I assist you with doctor appointments, departments, or hospital information today?",
      tools: ["searchKnowledge", "getEntity", "checkAvailability", "createAppointment"],
    },
    documents: [
      {
        id: 902,
        title: "MetroCare Doctors, Departments & Consultation Hours",
        category: "Clinical Services",
        content: `
Hospital: MetroCare Multi-Speciality Hospital & Research Center
Address: 102 Health Avenue, Medical District, Hyderabad
Emergency Hotline: +91 40 2345 6789 (24/7 Emergency & Trauma Unit)
General Reception: +91 40 2345 6700
Email: care@metrocarehospitals.com

Departments & Specialists:
• Cardiology: Head of Department: Dr. Rajesh Sharma, MD, DM (Cardiology). Specializes in interventional cardiology and heart failure. Consultation Fee: ₹1,000. OPD Hours: Monday to Friday, 10:00 AM – 2:00 PM.
• Neurology: Senior Consultant: Dr. Priya Nair, MD, DM (Neurology). Specializes in stroke rehabilitation, migraine, and epilepsy. Consultation Fee: ₹1,200. OPD Hours: Tuesday, Thursday, and Saturday, 11:00 AM – 3:00 PM.
• Pediatrics: Senior Pediatrician: Dr. Vikram Patel, MD (Pediatrics). OPD Hours: Monday to Saturday, 9:00 AM – 1:00 PM. Consultation Fee: ₹800.
• Orthopedics & Joint Replacement: Senior Surgeon: Dr. Suresh Menon, MS (Ortho). OPD Hours: Monday, Wednesday, Friday, 2:00 PM – 6:00 PM. Consultation Fee: ₹1,000.

Emergency & Ambulance:
• 24-hour emergency trauma care, blood bank, and fully equipped ICU ambulances available at dial 108 or +91 40 2345 6789.
• Cashless insurance desk covers Star Health, HDFC Ergo, ICICI Lombard, and CGHS.

Appointment Policy:
• Prior appointment recommended for OPD consultations. Walk-ins accepted subject to doctor availability.
• Telemedicine online video consultations available via patient portal.
        `.trim(),
      },
    ],
  },

  // 3. REAL ESTATE / PROPERTY
  {
    agent: {
      id: 974,
      name: "Marcus — Apex Realty & Urban Living",
      industry: "Real Estate & Housing",
      business_type: "Real Estate",
      personality: "Professional, consultative, knowledgeable, and proactive",
      system_prompt:
        "You are Marcus, lead property consultant AI for Apex Realty. Guide clients through premium residential apartments, commercial spaces, pricing, square footage, amenities, and site viewing appointments. Ground all property details strictly in catalog specs.",
      voice_enabled: true,
      voice_name: "Fenrir",
      greeting_message:
        "Welcome to Apex Realty & Urban Living. I'm Marcus. Are you looking for residential apartments, luxury villas, or scheduling a site visit today?",
      tools: ["searchKnowledge", "searchRecords", "checkAvailability", "createAppointment", "createLead"],
    },
    documents: [
      {
        id: 903,
        title: "Apex Horizon Towers — Residential Brochure & Price Sheet",
        category: "Properties",
        content: `
Company: Apex Realty & Urban Living
Project Name: Apex Horizon Towers
Location: Financial District, Gachibowli, Hyderabad
RERA Registration: P02400003891
Sales Office: +91 40 4890 1200
Email: sales@apexrealty.com

Property Configurations & Pricing:
• 2BHK Luxury Apartment: 1,280 sq.ft. Price: ₹95 Lakhs (all-inclusive except registration). Features 2 bedrooms, 2 bathrooms, west-facing balcony, modular kitchen provision.
• 3BHK Grand Suite: 1,850 sq.ft. Price: ₹1.45 Crores. Features 3 bedrooms, 3 bathrooms, maid's room, 2 covered car parkings, east-facing panoramic views.
• 4BHK Sky Villa Penthouse: 3,200 sq.ft. Price: ₹2.85 Crores. Duplex layout, private rooftop garden, 3 car parkings, smart home automation.

Amenities & Facilities:
• 40,000 sq.ft. Clubhouse with Olympic-sized swimming pool, badminton courts, and squash arena.
• 100% power backup and 24/7 multi-tier security surveillance.
• Possession Date: Phase 1 ready for possession in December 2026. Phase 2 by August 2027.

Viewing Appointments:
• On-site sample flats available for physical walkthrough daily from 10:00 AM to 6:30 PM.
• Virtual 3D interactive walkthroughs sent upon request via WhatsApp.
        `.trim(),
      },
    ],
  },

  // 4. RESTAURANT / DINING
  {
    agent: {
      id: 975,
      name: "Chef Marco — Saffron & Spice Bistro",
      industry: "Food & Beverage / Restaurant",
      business_type: "Restaurant",
      personality: "Epicurean, welcoming, delightful, and articulate",
      system_prompt:
        "You are Chef Marco, the virtual maître d' for Saffron & Spice Gourmet Bistro. Help guests explore the menu, check dietary ingredients (vegan, gluten-free, nut-free), opening hours, and table reservations.",
      voice_enabled: true,
      voice_name: "Kore",
      greeting_message:
        "Good day and welcome to Saffron & Spice Bistro! I am Marco. Would you like to view our gourmet menu, reserve a table, or check our operating hours?",
      tools: ["searchKnowledge", "getEntity", "checkAvailability", "createBooking", "sendDocument"],
    },
    documents: [
      {
        id: 904,
        title: "Saffron & Spice Bistro — Menu & Dining Details",
        category: "Menu",
        content: `
Restaurant: Saffron & Spice Gourmet Bistro
Address: 18 Jubilee Enclave, Road No. 36, Jubilee Hills
Phone: +91 40 6789 9000
Opening Hours: Lunch: 12:00 PM – 3:30 PM | Dinner: 7:00 PM – 11:30 PM (Tuesday to Sunday, Closed on Mondays)
Dress Code: Smart Casual

Signature Menu & Pricing:
• Truffle Mushroom Risotto: ₹750. Creamy Arborio rice with wild forest mushrooms, black truffle oil, and aged Parmigiano-Reggiano. (Vegetarian, Gluten-Free)
• Hyderabadi Dum Gosht Biryani: ₹850. Slow-cooked tender mutton with fragrant basmati rice, saffron, and aromatic whole spices. Served with Mirchi Ka Salan and Burani Raita.
• Pan-Seared Chilean Sea Bass: ₹1,250. Served on a bed of saffron cauliflower puree and citrus caper emulsion.
• Saffron Pistachio Kulfi Gelato: ₹380. Artisanal hand-churned frozen dessert infused with Kashmiri saffron and Iranian pistachios.

Table Reservations & Policies:
• Reservations recommended for dinner service and weekend seatings.
• Tables held for a grace period of 15 minutes past reservation time.
• Private Dining Room (PDR) available for gatherings up to 16 guests (minimum spend ₹20,000).
• Corkage fee: ₹1,500 per bottle for outside wine.
        `.trim(),
      },
    ],
  },

  // 5. SAAS & B2B TECH PLATFORM
  {
    agent: {
      id: 976,
      name: "Alex — CloudScale DevOps Platform",
      industry: "SaaS & Cloud Computing",
      business_type: "SaaS",
      personality: "Technical, crisp, knowledgeable, and solution-focused",
      system_prompt:
        "You are Alex, the enterprise solutions receptionist for CloudScale DevOps Platform. Assist developers, DevOps leads, and enterprise CTOs with subscription tiers, pricing, API limits, SLA guarantees, and demo bookings.",
      voice_enabled: true,
      voice_name: "Charon",
      greeting_message:
        "Welcome to CloudScale DevOps. I'm Alex. Are you interested in our automated Kubernetes CI/CD pipeline, enterprise pricing tiers, or booking a technical architecture demo?",
      tools: ["searchKnowledge", "getEntity", "calculate", "createLead", "createAppointment"],
    },
    documents: [
      {
        id: 905,
        title: "CloudScale Platform Specs, Pricing Tiers & SLA",
        category: "Product Specs",
        content: `
Company: CloudScale DevOps Technologies
Website: https://cloudscale.dev
Enterprise Sales: sales@cloudscale.dev
Support: 24/7/365 dedicated NOC

Pricing Plans & Tiers:
• Starter Tier: $49 / month. Includes up to 5 team members, 20 concurrent build pipelines, 500 GB container registry storage, community support.
• Professional Tier: $199 / month. Includes up to 25 team members, unlimited build pipelines, multi-cloud Kubernetes cluster deployment (AWS, GCP, Azure), priority email support.
• Enterprise Tier: $899 / month (custom volume discounts available). Includes unlimited users, dedicated VPC peering, SOC2 & HIPAA compliance, 99.99% uptime SLA, 15-minute response time guarantee, dedicated technical account manager.

Trial & Refund Policy:
• 14-day full-featured free trial with no credit card required.
• Annual subscriptions receive a 20% discount (paid upfront).
• 30-day money-back satisfaction guarantee on all annual plans.
        `.trim(),
      },
    ],
  },
];
