"""Base for every schema that crosses the HTTP boundary.

Internal code stays snake_case; JSON stays camelCase, matching the contract the
finished React client already consumes.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class WireModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        # Agent has a field literally named `model`, which collides with
        # pydantic's reserved model_ namespace unless protection is disabled.
        protected_namespaces=(),
    )
