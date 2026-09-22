# Project Instructions & System Freeze Mandate

## System Architecture & Behavior Lock (Frozen State)
- **Receptionist Engine & Intent Routing**: The existing receptionist routing engine, response structuring, lead qualification flows, dynamic quick replies, and domain handling in `/server.ts` and `/src/pages/PublicChat.tsx` / `/src/pages/ChatV2.tsx` are **FROZEN**.
- **Preservation Directive**: When adding new features, views, or endpoints, **NEVER** alter, break, or regress the existing conversational accuracy, course inquiry responses, fast-path synthesis, multi-question batching, or unsupported course detection logic.
- **Knowledge Base Grounding**: Maintain strict consistency with verified courses (e.g. Core Python Programming, Core Java Programming), batch timings, fees, and contact details without unsolicited changes.
