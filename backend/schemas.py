from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SEGMENT_REPORT_NOTE_MAX_LENGTH = 500

RATING_FIELD_BOUNDS: dict[str, tuple[int, int]] = {
    "overall_quality": (1, 10),
    "traffic_level": (1, 3),
    "road_surface": (1, 3),
    "gradient_profile": (1, 3),
    "sketchy_left_turns": (0, 2),
}

RATING_FIELDS = tuple(RATING_FIELD_BOUNDS.keys())


class SegmentCategoryRatingSchema(BaseModel):
    overall_quality: int = Field(ge=1, le=10)
    traffic_level: int = Field(ge=1, le=3)
    road_surface: int = Field(ge=1, le=3)
    gradient_profile: int = Field(ge=1, le=3)
    sketchy_left_turns: int = Field(ge=0, le=2)


class SegmentAverageRatingSchema(BaseModel):
    overall_quality: float | None = None
    traffic_level: float | None = None
    road_surface: float | None = None
    gradient_profile: float | None = None
    sketchy_left_turns: float | None = None


class SegmentSchema(BaseModel):
    name: str | None = None
    polyline: str | None = None
    strava_url: str | None = None
    distance_km: float | None = None
    gradient_pct: float | None = None
    approved: bool | None = False
    strava_id: str | None = None
    created_at: str | None = None
    blocked: bool | None = False
    block_message: str | None = None
    aliases: list[str] = Field(default_factory=list)
    ratings_count: int = 0
    average_ratings: SegmentAverageRatingSchema = Field(default_factory=SegmentAverageRatingSchema)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, extra="ignore")


class SegmentCreateSchema(BaseModel):
    name: str | None = None
    polyline: str | None = None
    strava_url: str | None = None
    distance_km: float | None = None
    gradient_pct: float | None = None
    ratings: SegmentCategoryRatingSchema

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, extra="ignore")


class QuickAddSchema(BaseModel):
    strava_url: str


class SegmentReportSchema(BaseModel):
    note: str | None = Field(default=None, max_length=SEGMENT_REPORT_NOTE_MAX_LENGTH)


class AdminBlockSegmentSchema(BaseModel):
    message: str | None = Field(default=None, max_length=SEGMENT_REPORT_NOTE_MAX_LENGTH)


class UserSummarySchema(BaseModel):
    actor_id: str


class SegmentAdminReportSchema(BaseModel):
    reported_by_actor_id: str
    reported_at: str
    action: str | None = None
    note: str | None = None


class SegmentAdminRatingSchema(BaseModel):
    id: str
    segment_id: str
    rated_by_actor_id: str
    rated_at: str | None = None
    ratings: SegmentCategoryRatingSchema


class SegmentPublicResponseSchema(SegmentSchema):
    id: str


class SegmentSubmitResponseSchema(SegmentPublicResponseSchema):
    status: Literal["created", "existing"]
    duplicate_reason: Literal["already_in_database", "under_review", "similar_segment"] | None = None
    rating_status: Literal["added", "updated"]


class SegmentResponseSchema(SegmentPublicResponseSchema):
    reported_by_actor_ids: list[str] = Field(default_factory=list)
    reported_by_users: list[UserSummarySchema] = Field(default_factory=list)
    block_reports: list[SegmentAdminReportSchema] = Field(default_factory=list)


class SegmentRatingResponseSchema(BaseModel):
    status: Literal["rated", "deleted"]
    ratings_count: int
    average_ratings: SegmentAverageRatingSchema


class AdminDeleteSegmentRatingResponseSchema(BaseModel):
    status: Literal["deleted"]
    ratings_count: int
    average_ratings: SegmentAverageRatingSchema


class AdminMergeSegmentSchema(BaseModel):
    target_segment_id: str


class AdminMergeSegmentResponseSchema(BaseModel):
    status: Literal["merged"]
    merged_from_segment_id: str
    merged_into_segment_id: str
    moved_ratings: int
    aliases: list[str] = Field(default_factory=list)


class AdminSplitSegmentResponseSchema(BaseModel):
    status: Literal["split"]
    source_segment_id: str
    created_segments: list[SegmentPublicResponseSchema] = Field(default_factory=list)
    skipped_aliases: list[str] = Field(default_factory=list)


class StravaCallbackSchema(BaseModel):
    code: str
    redirect_uri: str


class UserResponseSchema(BaseModel):
    actor_id: str
    is_admin: bool


class UserPreferencesSchema(BaseModel):
    hide_info_screen: bool = False
    rider_weight_kg: float = 75.0
    bike_weight_kg: float = 9.0
    interval_filter_power_watts: float = 250.0
    interval_filter_minutes: float = 5.0


class UserPreferencesUpdateSchema(BaseModel):
    hide_info_screen: bool | None = None
    rider_weight_kg: float | None = None
    bike_weight_kg: float | None = None
    interval_filter_power_watts: float | None = None
    interval_filter_minutes: float | None = None


class DisconnectResponseSchema(BaseModel):
    status: Literal["disconnected"]
    deauthorized_with_strava: bool
    deleted: dict[str, int]
