"""TypedDicts for the dict shapes passed around the package.

The canonical contract for the five durable artifact shapes (Scenario,
ScenarioResult, FindingCandidate, FindingTriage, Finding) is the JSON Schema
in ``config/*.json``; that is what enforces structure at IO boundaries via
``schemas.validate_*``. These TypedDicts mirror those schemas for in-process
developer ergonomics (editor autocomplete, optional static checking) and add
shapes for in-memory dicts that have no JSON Schema (recon items, inventory
rows, coverage pairs, router output, expert config).

Conventions:

- Every TypedDict is non-exhaustive at runtime. The JSON Schemas declare
  ``additionalProperties: true`` and several code paths attach extra keys
  (``_rank``, ``boundary_mandatory``, scenario ``DEFAULTS``, etc.).
- Required vs optional keys mirror the schema's ``required`` list, expressed
  via a ``_Base(TypedDict)`` + ``Shape(_Base, total=False)`` split so this
  works on Python >=3.9 without ``typing_extensions``.
- Enum-valued fields use ``Literal[...]`` where the schema enumerates them.
- ``oneOf [string, array]`` fields are typed as ``str | list[str]``.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, TypedDict, Union


# --------------------------------------------------------------------------
# Shared nested shapes
# --------------------------------------------------------------------------


class _EvidenceBase(TypedDict):
    path: str
    line: int | str
    snippet: str
    note: str


class Evidence(_EvidenceBase, total=False):
    """Source-line citation used in scenario results and proof obligations."""

    role: str


ScenarioPriority = Literal["critical", "high", "normal", "low"]
StringOrList = Union[str, List[str]]


# --------------------------------------------------------------------------
# Scenario (config/scenario-schema.json)
# --------------------------------------------------------------------------


class _ScenarioProofObligationBase(TypedDict):
    id: str
    question: str
    evidence_required: StringOrList


class ScenarioProofObligation(_ScenarioProofObligationBase, total=False):
    central: bool


class _ScenarioBase(TypedDict):
    id: str
    recon_item_id: str
    expert: str
    target_path: str
    proof_question: str
    evidence_required: StringOrList


class Scenario(_ScenarioBase, total=False):
    """Routed expert review unit. Lives under ``scenarios/backlog/S###.json``."""

    routing_unit_id: str
    covered_routing_unit_ids: StringOrList
    target_paths: StringOrList
    related_paths: StringOrList
    covered_paths: StringOrList
    security_invariant: str
    proof_obligations: list[ScenarioProofObligation]
    priority: ScenarioPriority
    routing_rationale: str
    expected_finding_width: str | int
    candidate_policy: str
    result_location: str
    # Not in the JSON Schema but read by backlog.py / coverage routing:
    boundary_id: str
    covered_boundary_ids: StringOrList


# --------------------------------------------------------------------------
# Scenario result (config/scenario-result-schema.json)
# --------------------------------------------------------------------------


ResultStatus = Literal["verified", "candidate", "rejected", "needs_context"]
ProofObligationStatus = Literal[
    "proven_safe", "proven_vulnerable", "not_applicable", "needs_context"
]


class _ResultProofObligationBase(TypedDict):
    id: str
    status: ProofObligationStatus
    summary: str


class ResultProofObligation(_ResultProofObligationBase, total=False):
    evidence: list[Evidence]


class _ScenarioResultBase(TypedDict):
    status: ResultStatus
    expert: str
    summary: str
    evidence: list[Evidence]
    scenario_id: str
    review_mode: Literal["per-scenario-subagent"]
    subagent_id: str
    scenario_prompt_sha256: str
    reviewed_files: list[str]


class ScenarioResult(_ScenarioResultBase, total=False):
    """Recorded per-scenario subagent answer. Lives under ``scenarios/finished/S###.json``."""

    primary_vulnerability_class: str
    proof_obligations: list[ResultProofObligation]
    surface_class_coverage: list[Any]
    same_root_expansion: list[Any]
    candidate_queue_entries: list[Any]
    findings: list[Finding]


# --------------------------------------------------------------------------
# Finding (config/finding-schema.json)
# --------------------------------------------------------------------------


Severity = Literal["critical", "high", "medium", "low", "informational", "unknown"]
FinalSeverity = Literal[
    "critical", "high", "medium", "low", "informational", "not_applicable"
]
Confidence = Literal["high", "medium", "low"]

# ``evidence`` in a finding is ``oneOf [str, list[object], object]``; we keep
# the loosest type alias to match that.
FindingEvidence = Union[str, List[Dict[str, Any]], Dict[str, Any]]


class _FindingBase(TypedDict):
    title: str
    severity: Severity
    target_path: str
    attacker_role: str
    preconditions: str
    non_technical_summary: str
    summary: str
    attack_chain: str
    example_attack: str
    evidence: FindingEvidence
    impact: str
    impact_analysis: str
    attacker_use: str
    recommended_fix: str
    validation_notes: str


class Finding(_FindingBase, total=False):
    """Materialized finding. Lives under ``findings/*.md`` after triage acceptance."""

    # Triage-derived fields layered on by ``triage._final_finding``:
    severity_rationale: str
    confidence: Confidence
    triage_decision: str
    triage_summary: str
    # Often present but not required by the schema:
    location: str
    line: int | str
    parameter: str
    sink: str
    affected_path: str
    scenario_id: str


# --------------------------------------------------------------------------
# Finding candidate (config/finding-candidate-schema.json)
# --------------------------------------------------------------------------


class _FindingCandidateBase(TypedDict):
    candidate_id: str
    scenario_id: str
    source_result: str
    expert: str
    status: Literal["pending_triage"]
    finding: Finding


class FindingCandidate(_FindingCandidateBase, total=False):
    """Pre-triage finding pulled out of a verified scenario result."""

    primary_vulnerability_class: str


# --------------------------------------------------------------------------
# Finding triage (config/finding-triage-schema.json)
# --------------------------------------------------------------------------


TriageDecision = Literal[
    "accepted", "downgraded", "duplicate", "rejected", "needs_context"
]


class _FindingTriageBase(TypedDict):
    candidate_id: str
    review_mode: Literal["per-finding-triage-agent"]
    triage_agent_id: str
    triage_prompt_sha256: str
    reviewed_files: list[str]
    decision: TriageDecision
    summary: str
    final_severity: FinalSeverity
    severity_rationale: str
    confidence: Confidence
    evidence_assessment: str
    evidence_gaps: list[Any]
    required_changes: list[Any]


class FindingTriage(_FindingTriageBase, total=False):
    """Recorded triage decision. Lives under ``finding-triage/decisions/S###-F###.json``."""

    dedupe_notes: str
    duplicate_of: str
    finding: Finding


# --------------------------------------------------------------------------
# Recon and inventory shapes (no JSON Schema; defined by code)
# --------------------------------------------------------------------------


class _InventoryRowBase(TypedDict):
    kind: str
    path: str
    line: int
    match: list[str]
    text: str


class InventoryRow(_InventoryRowBase, total=False):
    """Row written to ``recon-output/<kind>.jsonl`` by ``inventory.hits``."""

    id: str


class _RequestBoundaryBase(InventoryRow):
    endpoint: str | None
    methods: list[str]
    boundary_type: str
    trust_signals: list[str]
    request_fields: list[str]
    expert_hints: list[str]
    coverage: Literal["mandatory"]
    reason: str


class RequestBoundary(_RequestBoundaryBase, total=False):
    """Row in ``recon-output/request-boundaries.jsonl``."""

    recon_item_id: str


class _ReconItemBase(TypedDict):
    id: str
    type: str
    path: str
    signals: list[str]


class ReconItem(_ReconItemBase, total=False):
    """Row in ``recon-output/recon-items.jsonl``."""

    boundary_id: str
    endpoint: str | None
    methods: list[str]
    boundary_type: str
    request_fields: list[str]


class SemgrepReconItem(TypedDict, total=False):
    """Trimmed semgrep result attached to the router context."""

    check_id: str
    path: str
    line: int | None
    message: str
    metadata: dict[str, Any]


class InventoryPathEntry(TypedDict):
    """In-memory per-path roll-up built by ``coverage._path_index``."""

    kinds: set[str]
    rows: dict[str, list[InventoryRow]]
    signals: set[str]


# Mapping from inventory kind (``routes``, ``inputs``, ``request_boundaries``,
# ...) to its rows. Values can be ``RequestBoundary`` for the boundary kind;
# we use ``InventoryRow`` as the lowest common denominator since TypedDicts
# are non-exhaustive.
Inventory = Dict[str, List[InventoryRow]]


# --------------------------------------------------------------------------
# Coverage shapes (no JSON Schema)
# --------------------------------------------------------------------------


CoverageConfidence = Literal["high", "suggestion", "low"]


class _CoveragePairBase(TypedDict):
    expert: str
    path: str
    reason: str
    matched_terms: list[str]
    signals: list[str]
    kinds: list[str]
    evidence: list[dict[str, Any]]
    interesting: bool
    path_class: str


class CoveragePair(_CoveragePairBase, total=False):
    """Internal coverage candidate built by ``coverage._candidate_pairs``.

    Boundary-mandatory pairs additionally carry the request-boundary fields.
    Scored/public variants add ``confidence``, ``strong_terms``,
    ``triage_reason``, and (for requirements) ``requirement``.
    """

    boundary_mandatory: bool
    boundary_id: str
    recon_item_id: str
    endpoint: str | None
    methods: list[str]
    boundary_type: str
    request_fields: list[str]
    strong_terms: list[str]
    confidence: CoverageConfidence
    triage_reason: str
    requirement: str


CoverageDecisionValue = Literal[
    "scenario",
    "covered_by_scenario",
    "merged",
    "not_applicable",
    "needs_context",
    "out_of_scope",
]


class _CoverageDecisionBase(TypedDict):
    path: str
    decision: CoverageDecisionValue


class CoverageDecision(_CoverageDecisionBase, total=False):
    """Entry in ``scenarios/coverage-decisions.json`` and the router output."""

    routing_unit_id: str
    expert: str
    reason: str
    scenario_ids: StringOrList
    boundary_id: str


class CoverageGapEntry(TypedDict, total=False):
    """One ``input_with_sink_or_exposure`` entry in coverage-gaps.json."""

    path: str
    path_class: str
    reason: list[str]


class TriageSummary(TypedDict, total=False):
    expert_scope: str
    selected_experts: list[str]
    hard_requirement_paths: int
    hard_routing_requirements: int
    hard_boundary_requirements: int
    request_boundaries: int
    max_requirements_per_expert: int
    max_requirements_per_path: int
    suggestions_recorded: int
    suggestion_limit: int


class CoverageGaps(TypedDict, total=False):
    """Shape written to ``recon-output/coverage-gaps.json``."""

    input_with_sink_or_exposure: list[CoverageGapEntry]
    request_boundaries: list[RequestBoundary]
    boundary_requirements: list[CoveragePair]
    expert_opportunities: list[dict[str, Any]]
    routing_requirements: list[CoveragePair]
    coverage_suggestions: list[CoveragePair]
    triage_summary: TriageSummary


class RoutingUnit(TypedDict, total=False):
    """Clustered recon work unit written to ``recon-output/routing-units.jsonl``."""

    unit_id: str
    kind: str
    path: str
    path_class: str
    coverage: Literal["mandatory", "mandatory_path", "suggested"]
    required_experts: list[str]
    suggested_experts: list[str]
    candidate_experts: list[str]
    recon_item_ids: list[str]
    routing_requirement_keys: list[dict[str, Any]]
    signals: list[str]
    matched_terms: list[str]
    evidence: list[dict[str, Any]]
    raw_counts: dict[str, int]
    split_hint: str
    boundary_id: str
    endpoint: str | None
    methods: list[str]
    boundary_type: str
    request_fields: list[str]


# --------------------------------------------------------------------------
# Router output and expert config
# --------------------------------------------------------------------------


class RouterResult(TypedDict, total=False):
    """Shape of the scenario-router JSON ingested by ``backlog.record_backlog``."""

    scenarios: list[Scenario]
    coverage_decisions: list[CoverageDecision]
    coverage_notes: list[str]


ExpertScopeMode = Literal["all", "selected"]


class ExpertScope(TypedDict):
    """Persisted expert selection read from ``run-config.yaml``."""

    mode: ExpertScopeMode
    experts: list[str]


class _ExpertBase(TypedDict):
    id: str
    title: str
    category: str
    standard_refs: list[str]
    ownership: str
    routing_signals: list[str]


class Expert(_ExpertBase, total=False):
    """Entry in ``config/agents.json`` under ``experts``."""

    routes_from: list[str]


class OrchestrationAgent(TypedDict, total=False):
    id: str
    phase: str
    owns: str


class ReconAgent(TypedDict, total=False):
    id: str
    phase: str
    emits: list[str]
    signals: list[str]


class AgentRegistry(TypedDict, total=False):
    """Top-level shape of ``config/agents.json``."""

    orchestration: list[OrchestrationAgent]
    reconnaissance: list[ReconAgent]
    experts: list[Expert]
