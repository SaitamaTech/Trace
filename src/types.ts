export type EventType =
  | "order"
  | "payment"
  | "system"
  | "communication"
  | "security"
  | "custom";
export type RelationshipKind =
  | "caused_by"
  | "followed_by"
  | "related_to"
  | "contradicts"
  | "depends_on";
export interface User {
  id: number;
  name: string;
  email: string;
}
export interface EventRecord {
  id: number;
  user_id: number;
  title: string;
  description: string;
  type: EventType;
  occurred_at: string;
  source: string;
  created_at: string;
}
export interface Investigation {
  id: number;
  user_id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  event_count?: number;
}
export interface Relationship {
  id: number;
  user_id: number;
  source_event_id: number;
  target_event_id: number;
  kind: RelationshipKind;
  source_title?: string;
  target_title?: string;
}
export interface InvestigationDetail {
  investigation: Investigation;
  events: EventRecord[];
  relationships: Relationship[];
}
export interface Overview {
  totalEvents: number;
  activeInvestigations: number;
  recentEvents: EventRecord[];
  recentInvestigations: Investigation[];
}
export interface Finding {
  id: string;
  investigationId: number;
  investigationName: string;
  rule: string;
  title: string;
  detail: string;
  severity: "warning" | "critical";
}
export interface EventInput {
  title: string;
  description: string;
  type: EventType;
  occurredAt: string;
  source: string;
}
export interface InvestigationInput {
  name: string;
  description: string;
}
