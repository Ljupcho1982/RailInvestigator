/**
 * Rail occurrence ontology v0.1 (draft).
 * Designed to align with ERA/CSM occurrence categories, Swiss-cheese style
 * causal-factor modelling and the EU Directive 2016/798 recommendation workflow.
 */
export const ONTOLOGY_VERSION = "0.1.0";

export const NODE_TYPES = [
  "Occurrence",       // accident or serious incident (the investigation subject)
  "Event",            // timeline step within an occurrence
  "InfrastructureAsset", // track, signal, level crossing, switch, bridge...
  "RollingStock",     // vehicle / train unit
  "Train",            // a train service / consist on the day
  "Person",           // role-based; anonymised by default
  "Organisation",     // IM, RU, ECM, maintainer, regulator
  "Condition",        // weather, visibility, adhesion, fatigue state...
  "Evidence",         // document, data log, CCTV, interview, measurement
  "Finding",          // investigator's analytical finding
  "CausalFactor",     // direct / contributory / underlying / systemic
  "Procedure",        // rule, standard, SMS element
  "Consequence",      // fatalities, injuries, damage, disruption
  "Recommendation",   // safety recommendation
  "Action",           // follow-up action on a recommendation
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_TYPES = [
  "PART_OF",          // Event -> Occurrence
  "PRECEDES",         // Event -> Event (temporal order)
  "INVOLVES",         // Event|Occurrence -> Train/Asset/RollingStock/Person/Organisation
  "OCCURRED_UNDER",   // Event|Occurrence -> Condition
  "CAUSED",           // CausalFactor|Event -> Event|CausalFactor|Consequence (causal claim)
  "CONTRIBUTED_TO",   // CausalFactor -> Event|Consequence
  "SUPPORTED_BY",     // Finding|CausalFactor|Event -> Evidence
  "VIOLATED",         // Event|Person|Organisation -> Procedure
  "RESULTED_IN",      // Occurrence -> Consequence
  "RESPONSIBLE_FOR",  // Organisation -> Asset|RollingStock|Procedure
  "ADDRESSES",        // Recommendation -> CausalFactor|Finding
  "ADDRESSED_TO",     // Recommendation -> Organisation
  "IMPLEMENTS",       // Action -> Recommendation
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

type Rule = { from: readonly NodeType[]; to: readonly NodeType[] };
const T = (...t: NodeType[]) => t;
const PHYSICAL = T("Train", "InfrastructureAsset", "RollingStock", "Person", "Organisation");

/** Allowed (from, to) node types for each edge type. */
export const EDGE_RULES: Record<EdgeType, Rule> = {
  PART_OF: { from: T("Event"), to: T("Occurrence") },
  PRECEDES: { from: T("Event"), to: T("Event") },
  INVOLVES: { from: T("Event", "Occurrence"), to: PHYSICAL },
  OCCURRED_UNDER: { from: T("Event", "Occurrence"), to: T("Condition") },
  CAUSED: { from: T("CausalFactor", "Event"), to: T("Event", "CausalFactor", "Consequence") },
  CONTRIBUTED_TO: { from: T("CausalFactor"), to: T("Event", "Consequence") },
  SUPPORTED_BY: { from: T("Finding", "CausalFactor", "Event"), to: T("Evidence") },
  VIOLATED: { from: T("Event", "Person", "Organisation"), to: T("Procedure") },
  RESULTED_IN: { from: T("Occurrence"), to: T("Consequence") },
  RESPONSIBLE_FOR: { from: T("Organisation"), to: T("InfrastructureAsset", "RollingStock", "Procedure") },
  ADDRESSES: { from: T("Recommendation"), to: T("CausalFactor", "Finding") },
  ADDRESSED_TO: { from: T("Recommendation"), to: T("Organisation") },
  IMPLEMENTS: { from: T("Action"), to: T("Recommendation") },
};

export const OCCURRENCE_CLASS = ["accident", "serious_incident", "incident"] as const;
export const CAUSAL_LEVEL = ["direct", "contributory", "underlying", "systemic"] as const;

export function validateEdge(type: EdgeType, from: NodeType, to: NodeType): string | null {
  const rule = EDGE_RULES[type];
  if (!rule) return `unknown edge type ${type}`;
  if (!rule.from.includes(from)) return `${type}: source ${from} not allowed`;
  if (!rule.to.includes(to)) return `${type}: target ${to} not allowed`;
  return null;
}
