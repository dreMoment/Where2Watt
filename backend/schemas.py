from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SEGMENT_REPORT_NOTE_MAX_LENGTH = 500
SEGMENT_RATING_MIN = 1
SEGMENT_RATING_MAX = 10


class SegmentCategoryRatingSchema(BaseModel):
    traffic: int = Field(ge=SEGMENT_RATING_MIN, le=SEGMENT_RATING_MAX)
    steady_gradient: int = Field(ge=SEGMENT_RATING_MIN, le=SEGMENT_RATING_MAX)
    sketchy_left_turns: int = Field(ge=SEGMENT_RATING_MIN, le=SEGMENT_RATING_MAX)
    downhills: int = Field(ge=SEGMENT_RATING_MIN, le=SEGMENT_RATING_MAX)


class SegmentAverageRatingSchema(BaseModel):
    traffic: float | None = None
    steady_gradient: float | None = None
    sketchy_left_turns: float | None = None
    downhills: float | None = None


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


class SegmentResponseSchema(SegmentSchema):
    id: str
    submitted_by_actor_id: str | None = None
    reported_by_actor_ids: list[str] = Field(default_factory=list)
    submitted_by_user: UserSummarySchema | None = None
    reported_by_users: list[UserSummarySchema] = Field(default_factory=list)
    block_reports: list[SegmentAdminReportSchema] = Field(default_factory=list)


class SegmentRatingResponseSchema(BaseModel):
    status: Literal["rated"]
    ratings_count: int
    average_ratings: SegmentAverageRatingSchema


class AdminDeleteSegmentRatingResponseSchema(BaseModel):
    status: Literal["deleted"]
    ratings_count: int
    average_ratings: SegmentAverageRatingSchema


class StravaCallbackSchema(BaseModel):
    code: str
    redirect_uri: str


class UserResponseSchema(BaseModel):
    actor_id: str
    is_admin: bool
