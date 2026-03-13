import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchUserPreferences, updateUserPreferences } from "@/utils/api";
import { usePreferenceSync } from "@/hooks/usePreferenceSync";

const HIDE_INFO_SCREEN_STORAGE_KEY = "hideLandingInfoScreen";
const RIDER_WEIGHT_STORAGE_KEY = "riderWeight";
const BIKE_WEIGHT_STORAGE_KEY = "bikeWeight";
const PLANNED_POWER_STORAGE_KEY = "plannedPower";
const INTERVAL_FILTER_TIME_STORAGE_KEY = "intervalFilterTime";
interface UseHomePreferencesParams {
  authLoading: boolean;
  isLoggedIn: boolean;
  token: string | null;
  isMobileViewport: boolean;
  onPreferencePersistError?: () => void;
}

export function useHomePreferences({
  authLoading,
  isLoggedIn,
  token,
  isMobileViewport,
  onPreferencePersistError,
}: UseHomePreferencesParams) {
  const isClient = typeof window !== "undefined";
  const preferencesReady = isClient;
  // Seed UI state from localStorage so controls render immediately before network hydration finishes.
  const [weightStr, setWeightStr] = useState(() => {
    if (!isClient) {
      return "";
    }
    return localStorage.getItem(RIDER_WEIGHT_STORAGE_KEY) ?? "75";
  });
  const [bikeWeightStr, setBikeWeightStr] = useState(() => {
    if (!isClient) {
      return "";
    }
    return localStorage.getItem(BIKE_WEIGHT_STORAGE_KEY) ?? "9";
  });
  const [filterPowerStr, setFilterPowerStr] = useState(() => {
    if (!isClient) {
      return "";
    }
    return localStorage.getItem(PLANNED_POWER_STORAGE_KEY) ?? "250";
  });
  const [filterTimeStr, setFilterTimeStr] = useState(() => {
    if (!isClient) {
      return "";
    }
    return localStorage.getItem(INTERVAL_FILTER_TIME_STORAGE_KEY) ?? "5";
  });
  const [hideInfoScreenNextTime, setHideInfoScreenNextTime] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return localStorage.getItem(HIDE_INFO_SCREEN_STORAGE_KEY) === "true";
  });
  const [showInfoScreen, setShowInfoScreen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return localStorage.getItem(HIDE_INFO_SCREEN_STORAGE_KEY) !== "true";
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const shouldShowInfoScreen = localStorage.getItem(HIDE_INFO_SCREEN_STORAGE_KEY) !== "true";
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    return !isMobile && !shouldShowInfoScreen;
  });
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);

  // Canonical payload used by debounced preference syncing.
  const preferencePayload = useMemo(() => {
    const riderWeight = Number.parseFloat(weightStr);
    const bikeWeight = Number.parseFloat(bikeWeightStr);
    const intervalFilterPower = Number.parseFloat(filterPowerStr);
    const intervalFilterMinutes = Number.parseFloat(filterTimeStr);

    return {
      rider_weight_kg: Number.isFinite(riderWeight) ? riderWeight : 75,
      bike_weight_kg: Number.isFinite(bikeWeight) ? bikeWeight : 9,
      interval_filter_power_watts: Number.isFinite(intervalFilterPower) ? intervalFilterPower : 250,
      interval_filter_minutes: Number.isFinite(intervalFilterMinutes) ? intervalFilterMinutes : 5,
    };
  }, [bikeWeightStr, filterPowerStr, filterTimeStr, weightStr]);

  const { setPersistedSnapshot } = usePreferenceSync({
    enabled: !authLoading && isLoggedIn && preferencesHydrated,
    token,
    payload: preferencePayload,
    persist: updateUserPreferences,
    onNonRateLimitError: onPreferencePersistError,
  });

  useEffect(() => {
    if (authLoading || !isLoggedIn || !token) {
      return;
    }

    let cancelled = false;

    // Logged-in users override local defaults with server preferences for cross-device consistency.
    fetchUserPreferences(token)
      .then((preferences) => {
        if (cancelled) {
          return;
        }

        const riderWeight = String(preferences.rider_weight_kg ?? 75);
        const bikeWeight = String(preferences.bike_weight_kg ?? 9);
        const plannedPower = String(preferences.interval_filter_power_watts ?? 250);
        const filterTime = String(preferences.interval_filter_minutes ?? 5);

        setWeightStr(riderWeight);
        setBikeWeightStr(bikeWeight);
        setFilterPowerStr(plannedPower);
        setFilterTimeStr(filterTime);
        setHideInfoScreenNextTime(preferences.hide_info_screen);

        localStorage.setItem(RIDER_WEIGHT_STORAGE_KEY, riderWeight);
        localStorage.setItem(BIKE_WEIGHT_STORAGE_KEY, bikeWeight);
        localStorage.setItem(PLANNED_POWER_STORAGE_KEY, plannedPower);
        localStorage.setItem(INTERVAL_FILTER_TIME_STORAGE_KEY, filterTime);

        const shouldShowInfoScreen = !preferences.hide_info_screen;
        setShowInfoScreen(shouldShowInfoScreen);
        setSidebarOpen((previous) => (isMobileViewport ? previous : !shouldShowInfoScreen));
        setPersistedSnapshot(
          JSON.stringify({
            rider_weight_kg: Number.parseFloat(riderWeight),
            bike_weight_kg: Number.parseFloat(bikeWeight),
            interval_filter_power_watts: Number.parseFloat(plannedPower),
            interval_filter_minutes: Number.parseFloat(filterTime),
          })
        );
        setPreferencesHydrated(true);
      })
      .catch((preferenceError) => {
        console.error("Failed to fetch user preferences:", preferenceError);
        setPreferencesHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isLoggedIn, token, isMobileViewport, setPersistedSnapshot]);

  // Each input writes to state + localStorage so anonymous sessions still preserve values.
  const handleWeightChange = useCallback((nextWeight: string) => {
    setWeightStr(nextWeight);
    localStorage.setItem(RIDER_WEIGHT_STORAGE_KEY, nextWeight);
  }, []);

  const handleBikeWeightChange = useCallback((nextBikeWeight: string) => {
    setBikeWeightStr(nextBikeWeight);
    localStorage.setItem(BIKE_WEIGHT_STORAGE_KEY, nextBikeWeight);
  }, []);

  const handleFilterPowerChange = useCallback((nextPower: string) => {
    setFilterPowerStr(nextPower);
    localStorage.setItem(PLANNED_POWER_STORAGE_KEY, nextPower);
  }, []);

  const handleFilterTimeChange = useCallback((nextFilterTime: string) => {
    setFilterTimeStr(nextFilterTime);
    localStorage.setItem(INTERVAL_FILTER_TIME_STORAGE_KEY, nextFilterTime);
  }, []);

  const closeInfoScreen = useCallback(async () => {
    // Persist onboarding-dismiss preference locally and remotely when authenticated.
    localStorage.setItem(HIDE_INFO_SCREEN_STORAGE_KEY, hideInfoScreenNextTime ? "true" : "false");

    if (isLoggedIn && token) {
      try {
        await updateUserPreferences(token, { hide_info_screen: hideInfoScreenNextTime });
      } catch (preferenceError) {
        console.error("Failed to update user preferences:", preferenceError);
        onPreferencePersistError?.();
      }
    }

    setShowInfoScreen(false);
    if (!isMobileViewport) {
      setSidebarOpen(true);
    }
  }, [hideInfoScreenNextTime, isLoggedIn, token, isMobileViewport, onPreferencePersistError]);

  const openInfoScreen = useCallback(() => {
    setShowInfoScreen(true);
    setSidebarOpen(false);
  }, []);

  return {
    bikeWeightStr,
    closeInfoScreen,
    filterTimeStr,
    filterPowerStr,
    handleBikeWeightChange,
    handleFilterPowerChange,
    handleFilterTimeChange,
    handleWeightChange,
    hideInfoScreenNextTime,
    openInfoScreen,
    preferencesReady,
    setHideInfoScreenNextTime,
    setSidebarOpen,
    showInfoScreen,
    sidebarOpen,
    weightStr,
  };
}
