import { get, post } from "./client";

export interface IntegrationSummary {
  key: string;
  name: string;
  category: string;
  description: string;
  status: "configured" | "available";
  setup_hint: string;
  capabilities: string[];
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  header: string;
  body: string;
}

export function getIntegrations(): Promise<{ integrations: IntegrationSummary[] }> {
  return get<{ integrations: IntegrationSummary[] }>("/integrations");
}

export function getWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  return get<WhatsAppTemplate[]>("/integrations/whatsapp/templates");
}

export function simulateWhatsAppWebhook(from: string, message: string): Promise<{
  status: string;
  reply: string;
  recipient: string;
  tools_executed: unknown[];
}> {
  return post("/integrations/whatsapp/webhook", { from, message });
}

export function sendWhatsAppTest(params: {
  to: string;
  template: string;
  recipient_name: string;
}): Promise<{
  success: boolean;
  message_id: string;
  status: string;
  details: string;
}> {
  return post("/integrations/whatsapp/send-test", params);
}
