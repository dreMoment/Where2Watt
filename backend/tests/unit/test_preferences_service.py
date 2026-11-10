import pytest

from services.preferences import normalize_user_preferences


@pytest.mark.unit
def test_normalize_user_preferences_preserves_valid_fields_and_repairs_invalid_fields():
    assert normalize_user_preferences(
        {
            "hide_info_screen": True,
            "rider_weight_kg": 72.5,
            "bike_weight_kg": -1,
            "interval_filter_power_watts": "not-a-number",
            "interval_filter_minutes": 8,
            "actor_id": "private-field",
        }
    ) == {
        "hide_info_screen": True,
        "rider_weight_kg": 72.5,
        "bike_weight_kg": 9.0,
        "interval_filter_power_watts": 250.0,
        "interval_filter_minutes": 8.0,
    }
