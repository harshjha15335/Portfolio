"""Build the Andheri AI Integration Lab fixtures from a NORTHSTAR checkout.

Usage: python3 -I scripts/projects/northstar_guard_reference.py <northstar-checkout> <out.json>

Each case is a raw model reply. The script runs it through the same steps NORTHSTAR uses:
the code-fence cleanup in XAIProvider.propose, TradeProposal.model_validate_json (the real
Pydantic model from app/schemas.py, imported unchanged), and DecisionAgent.decide (the class
source is loaded from app/agents.py and executed unchanged). The portfolio's TypeScript port
(src/projects/aiguard.ts) is tested against the recorded outcomes.
"""
import ast
import importlib.util
import json
import sys
import textwrap
from decimal import Decimal
from pathlib import Path

root, out = Path(sys.argv[1]), Path(sys.argv[2])
app = root / "trading-platform/backend/app"

spec = importlib.util.spec_from_file_location("northstar_schemas", app / "schemas.py")
schemas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(schemas)
TradeProposal = schemas.TradeProposal

agents_source = (app / "agents.py").read_text()
ns = {"TradeProposal": TradeProposal, "now": schemas.now, "Decimal": Decimal}
for node in ast.walk(ast.parse(agents_source)):
    if isinstance(node, ast.ClassDef) and node.name == "DecisionAgent":
        exec(textwrap.dedent(ast.get_source_segment(agents_source, node)), ns)
DecisionAgent = ns["DecisionAgent"]


def strip_fences(content: str) -> str:
    # Copied from XAIProvider.propose.
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()
    return cleaned


EVIDENCE = {
    "symbol": "ITC",
    "cycle_id": "cycle-demo-001",
    "quote": {"price": "420"},
    "source_ids": ["mock-fundamental-ITC", "mock-technical-ITC"],
}

BASE = {
    "cycle_id": "cycle-demo-001",
    "symbol": "ITC",
    "action": "NO_ACTION",
    "confidence": 0.74,
    "current_price": 420,
    "proposed_quantity": 0,
    "estimated_order_value": 0,
    "maximum_entry_price": 424.2,
    "thesis": "Evidence does not justify adding risk; preserve cash and monitor.",
    "why_now": "Synthetic paper-testing scenario only; no real market timing claim.",
    "fundamental_view": "MOCK / INCOMPLETE",
    "technical_view": "SIDEWAYS",
    "news_view": "MOCK / NEUTRAL",
    "quant_view": "Synthetic backtest; insufficient real-world evidence",
    "portfolio_context": "Capital preservation with isolated strategy allocation",
    "bull_case": "Illustrative improvement in demand and margins",
    "base_case": "Maintain stable operating performance",
    "bear_case": "Demand contraction and valuation compression",
    "supporting_factors": ["Controlled paper-only demonstration"],
    "major_risks": ["All inputs are synthetic", "No return is guaranteed"],
    "entry_conditions": ["Every deterministic risk check passes"],
    "invalidation_conditions": ["Verified thesis deterioration"],
    "expected_holding_period": "Review each monitoring cycle",
    "source_ids": ["mock-fundamental-ITC"],
}
BUY = {**BASE, "action": "BUY", "proposed_quantity": 1, "estimated_order_value": 420,
       "thesis": "MOCK demonstration: a small cash-equity allocation exercises the complete pipeline."}


def j(obj):
    return json.dumps(obj, indent=2, ensure_ascii=False)


def without(obj, *keys):
    return {k: v for k, v in obj.items() if k not in keys}


CASES = [
    ("no-action", "Valid NO_ACTION", j(BASE)),
    ("buy", "Valid BUY, one share", j(BUY)),
    ("fenced", "Valid, wrapped in a ```json fence", "```json\n" + j(BUY) + "\n```"),
    ("prose", "Prose instead of JSON", "I think ITC looks strong. Buy 1 share around 420."),
    ("array", "A JSON array, not an object", j([BUY])),
    ("missing", "Missing narrative fields", j(without(BUY, "thesis", "bear_case", "source_ids"))),
    ("extra", "Invents a price target", j({**BUY, "target_price": 520})),
    ("confidence", "Confidence above 1", j({**BUY, "confidence": 1.4})),
    ("action", "Action outside the allowed set", j({**BUY, "action": "STRONG_BUY"})),
    ("qty-string", "Quantity as a string", j({**BUY, "proposed_quantity": "1"})),
    ("qty-float", "Fractional quantity", j({**BUY, "proposed_quantity": 1.5})),
    ("entry-zero", "maximum_entry_price of 0", j({**BUY, "maximum_entry_price": 0})),
    ("thesis-number", "Number where text is required", j({**BUY, "thesis": 42})),
    ("confidence-string", "Confidence as a numeric string", j({**BUY, "confidence": "0.7"})),
    ("nan", "Non-finite price", j({**BUY, "current_price": "Infinity"})),
    ("symbol", "Swaps the instrument", j({**BUY, "symbol": "INFY"})),
    ("cycle", "Changes the cycle id", j({**BUY, "cycle_id": "cycle-demo-999"})),
    ("price", "Price differs from the quote", j({**BUY, "current_price": 425, "estimated_order_value": 425})),
    ("value", "Order value doesn't match price × quantity", j({**BUY, "estimated_order_value": 500})),
    ("hold-qty", "HOLD with a quantity", j({**BASE, "action": "HOLD", "proposed_quantity": 2, "estimated_order_value": 840})),
    ("buy-zero", "BUY with no quantity", j({**BUY, "proposed_quantity": 0, "estimated_order_value": 0})),
    ("dup-source", "Duplicate source ids", j({**BUY, "source_ids": ["mock-fundamental-ITC", "mock-fundamental-ITC"]})),
    ("unknown-source", "Cites a source it never received", j({**BUY, "source_ids": ["reuters-2026-10-14"]})),
]

# Edge cases for the port's tests only (not offered as presets in the exhibit).
PROBES = [
    ("probe-qty-float-int", "Quantity written as 1.0", j(BUY).replace('"proposed_quantity": 1,', '"proposed_quantity": 1.0,')),
    ("probe-bools", "Booleans in typed fields", j({**BUY, "proposed_quantity": True, "confidence": False, "major_risks": [1]})),
    ("probe-parsing", "Unparseable decimal, negative quantity, string list", j({**BUY, "proposed_quantity": -1, "current_price": "abc", "source_ids": "x"})),
    ("probe-nulls", "Nulls", j({**BUY, "estimated_order_value": None, "supporting_factors": None, "symbol": None})),
    ("probe-timestamp", "Unparseable timestamp", j({**BUY, "timestamp": "yesterday"})),
    ("probe-order", "Missing, invalid and extra fields together", j({**without(BUY, "cycle_id", "why_now"), "zzz": 1, "aaa": 2, "confidence": -0.1})),
]

results = []
for case_id, label, raw in CASES + PROBES:
    cleaned = strip_fences(raw)
    record = {"id": case_id, "label": label, "raw": raw}
    try:
        proposal = TradeProposal.model_validate_json(cleaned)
    except Exception as error:  # pydantic.ValidationError
        record.update(stage="schema", errors=[
            {"loc": [str(p) for p in e["loc"]], "type": e["type"], "msg": e["msg"]}
            for e in error.errors(include_url=False)
        ])
        results.append(record)
        continue
    try:
        DecisionAgent().decide(type("Fixed", (), {"propose": lambda self, _e: proposal})(), EVIDENCE)
    except ValueError as error:
        record.update(stage="decision", message=str(error))
        results.append(record)
        continue
    record.update(stage="accepted")
    results.append(record)

out.write_text(json.dumps({
    "source": "harshjha15335/NORTHSTAR",
    "commit": "10e96d3807b9d302cf33c03f29ff37b97232beb2",
    "evidence": EVIDENCE,
    "cases": results,
}, indent=1, ensure_ascii=False) + "\n")
print(f"wrote {len(results)} cases to {out}")
for r in results:
    print(r["id"], r["stage"], r.get("message") or [(e["loc"], e["type"]) for e in r.get("errors", [])])
