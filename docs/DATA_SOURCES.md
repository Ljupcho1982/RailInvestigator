# Public report sources

Verified by web search (Oct 2026). Check each publisher's reuse/licence terms before redistributing; this repo
stores **only the manifest**, not the PDFs (`data/reports/` is git-ignored).

| Source | Country/scope | Where | Notes |
|---|---|---|---|
| RAIB | UK | https://www.gov.uk/raib | Reports + interim reports as PDF on assets.publishing.service.gov.uk. Consistent structure (Summary, Key facts, Analysis, Learning points, Recommendations) — best first corpus. |
| NTSB | USA | https://www.ntsb.gov/investigations/AccidentReports/Reports/RIRyynn.pdf | `RIR-YY-NN` railroad reports; includes findings, probable cause, recommendations. |
| RAIU | Ireland | https://www.raiu.ie/ | Small, English-language. |
| ERA / ERADIS | EU | https://eradis.era.europa.eu/safety_docs/naib/default.aspx | National investigation body reports collected under Directive 2016/798 Art. 24; many languages. ERAIL itself is reported as disconnected — use ERA's Rail Accident Investigation page. |
| ERA ERAIL recommendations dataset | EU | listed via api.store (open data) | Machine-readable safety recommendations — useful for the recommendation tracker. |

## Prior art to review
"LLM Techniques for EU Accident Report Processing" (CEUR-WS Vol-4079, short4) — appeared in search, but the
host was unreachable from the sandbox so it is **unread**. Read before designing the evaluation.

## Suggested first corpus
~20 RAIB reports (consistent format) + ~10 NTSB RIR reports, mixed accident types (collision, derailment,
level crossing, SPAD, worker fatality). Hand-label 3 for the gold set.
