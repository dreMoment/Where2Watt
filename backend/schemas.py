from pydantic import BaseModel, ConfigDict, Field

SEGMENT_REPORT_NOTE_MAX_LENGTH = 500


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


class SegmentResponseSchema(SegmentSchema):
    id: str
    submitted_by_actor_id: str | None = None
    blocked_report_count: int | None = 0
    reported_by_actor_ids: list[str] = Field(default_factory=list)
    submitted_by_user: UserSummarySchema | None = None
    reported_by_users: list[UserSummarySchema] = Field(default_factory=list)
    block_reports: list[SegmentAdminReportSchema] = Field(default_factory=list)


class StravaCallbackSchema(BaseModel):
    code: str
    redirect_uri: str


class UserResponseSchema(BaseModel):
    actor_id: str
    is_admin: bool
