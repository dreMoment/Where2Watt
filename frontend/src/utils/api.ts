/**
 * Backwards-compatible public API surface.
 *
 * Implementations live in domain modules so each area can evolve independently.
 * New code may import a domain module directly when it only needs one API area.
 */
export * from "@/utils/api/admin";
export * from "@/utils/api/auth";
export * from "@/utils/api/segments";
export { API_BASE_URL } from "@/utils/apiClient";
