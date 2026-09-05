from pydantic import ValidationError

from schemas import UserPreferencesSchema


DEFAULT_USER_PREFERENCES = UserPreferencesSchema().model_dump()


def normalize_user_preferences(document: object) -> dict:
    """Return valid public preferences even when a legacy database row is malformed."""
    normalized = dict(DEFAULT_USER_PREFERENCES)
    if not isinstance(document, dict):
        return normalized

    for field_name in DEFAULT_USER_PREFERENCES:
        if field_name not in document:
            continue
        try:
            validated = UserPreferencesSchema.model_validate({field_name: document[field_name]})
        except (TypeError, ValueError, ValidationError):
            continue
        normalized[field_name] = getattr(validated, field_name)

    return normalized
