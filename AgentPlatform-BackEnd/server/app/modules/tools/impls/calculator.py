"""Evaluates an arithmetic expression."""

import ast
import math
import operator
from typing import Any, ClassVar

from app.modules.tools.base import ToolParam, ToolResult, ToolSchema

# eval() on an LLM-supplied string is remote code execution. The expression is
# parsed instead, and only these node types survive the walk.
_BINARY = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}

# 9 ** 9 ** 9 would occupy the process for the rest of the afternoon.
_MAX_EXPONENT = 1000


def _finite(value: float) -> float:
    """Reject inf and nan before they can leave the tool.

    JSON has no way to spell either, but Python's json.dumps writes the bare
    tokens `Infinity` and `NaN` rather than refusing. That output would reach
    the browser as a malformed chat response *and* be handed to asyncpg as
    invalid JSONB when the run is stored — a serialization failure two layers
    away from the expression that caused it. `1e309` is enough to trigger it.
    """
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Result is not a finite number.")
    return value


def _evaluate(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _evaluate(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, int | float):
            raise ValueError("Only numbers are allowed.")
        return _finite(node.value)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
        return _finite(_UNARY[type(node.op)](_evaluate(node.operand)))
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
        left, right = _evaluate(node.left), _evaluate(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > _MAX_EXPONENT:
            raise ValueError(f"Exponent is too large (limit {_MAX_EXPONENT}).")
        return _finite(_BINARY[type(node.op)](left, right))
    raise ValueError("Only arithmetic on numbers is supported.")


class CalculatorTool:
    schema: ClassVar[ToolSchema] = ToolSchema(
        id="calculator",
        label="Calculator",
        description="Evaluates an arithmetic expression.",
        params=[
            ToolParam(
                name="expression",
                type="string",
                required=True,
                description="Expression to evaluate.",
            )
        ],
    )

    async def execute(self, **kwargs: Any) -> ToolResult:
        expression = kwargs.get("expression")
        if not isinstance(expression, str) or not expression.strip():
            return ToolResult(ok=False, error="expression must be a non-empty string.")
        try:
            value = _evaluate(ast.parse(expression, mode="eval"))
        except ZeroDivisionError:
            return ToolResult(ok=False, error="Division by zero.")
        except (SyntaxError, ValueError, TypeError, OverflowError) as exc:
            return ToolResult(ok=False, error=f"Could not evaluate: {exc}")
        return ToolResult(ok=True, value=value)
