# Ontology v0.1 (draft)

Source of truth: `core/src/ontology.ts` (enforced by `validateEdge`).

## Node types
Occurrence, Event, InfrastructureAsset, RollingStock, Train, Person (role-based, anonymised by default),
Organisation, Condition, Evidence, Finding, CausalFactor (`direct|contributory|underlying|systemic`),
Procedure, Consequence, Recommendation, Action.

## Edge types (allowed source -> target)
| Edge | From | To |
|---|---|---|
| PART_OF | Event | Occurrence |
| PRECEDES | Event | Event |
| INVOLVES | Event, Occurrence | Train, Asset, RollingStock, Person, Organisation |
| OCCURRED_UNDER | Event, Occurrence | Condition |
| CAUSED | CausalFactor, Event | Event, CausalFactor, Consequence |
| CONTRIBUTED_TO | CausalFactor | Event, Consequence |
| SUPPORTED_BY | Finding, CausalFactor, Event | Evidence |
| VIOLATED | Event, Person, Organisation | Procedure |
| RESULTED_IN | Occurrence | Consequence |
| RESPONSIBLE_FOR | Organisation | Asset, RollingStock, Procedure |
| ADDRESSES | Recommendation | CausalFactor, Finding |
| ADDRESSED_TO | Recommendation | Organisation |
| IMPLEMENTS | Action | Recommendation |

## Open design questions
- Map `Occurrence.class` and event categories to the ERA/CSM occurrence taxonomy and ERAIL fields.
- Add optional overlays for AcciMap / STAMP-CAST views without changing the core schema.
- Uncertainty: should causal edges carry investigator-assigned likelihood (e.g. "probable")?
- Versioning/migration policy for ontology changes across saved investigations.
