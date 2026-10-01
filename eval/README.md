# Evaluation

Gold files: `eval/gold/<report-id>.json` with `{ "nodes": [{type,label}], "edges": [{type,from,to}] }`
(edges reference node labels). Label 3 reports by hand first; keep to facts stated in the report.

Scoring (`core/src/extract/evaluate.ts`): fuzzy label match (word-set Jaccard >= 0.5) plus exact type match,
precision/recall/F1 for nodes, edges and — separately — causal edges. Targets for the review-queue workflow
to be useful: node recall >= 0.8; causal-edge precision >= 0.9 (a wrong causal claim costs more than a miss).
