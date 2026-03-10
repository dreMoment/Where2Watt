import { useCallback, useEffect, useState } from "react";
import { fetchUserPreferences, updateUserPreferences } from "@/utils/api";

const HIDE_INFO_SCREEN_STORAGE_KEY = "hideLandingInfoScreen";

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
  const [weightStr, setWeightStr] = useState(() => {
    if (typeof window === "undefined") {
      return "75";
    }
    return localStorage.getItem("riderWeight") ?? "75";
  });
  const [bikeWeightStr, setBikeWeightStr] = useState(() => {
    if (typeof window === "undefined") {
      return "9";
    }
    return localStorage.getItem("bikeWeight") ?? "9";
  });
  const [filterPowerStr, setFilterPowerStr] = useState(() => {
    if (typeof window === "undefined") {
      return "250";
    }
    return localStorage.getItem("plannedPower") ?? "250";
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

  useEffect(() => {
    if (authLoading || !isLoggedIn || !token) {
      return;
    }

    let cancelled = false;

    fetchUserPreferences(token)
      .then((preferences) => {
        if (cancelled) {
          return;
        }

        setHideInfoScreenNextTime(preferences.hide_info_screen);
        const shouldShowInfoScreen = !preferences.hide_info_screen;
        setShowInfoScreen(shouldShowInfoScreen);
        setSidebarOpen((previous) => (isMobileViewport ? previous : !shouldShowInfoScreen));
      })
      .catch((preferenceError) => {
        console.error("Failed to fetch user preferences:", preferenceError);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isLoggedIn, token, isMobileViewport]);

  const handleWeightChange = useCallback((nextWeight: string) => {
    setWeightStr(nextWeight);
    localStorage.setItem("riderWeight", nextWeight);
  }, []);

  const handleBikeWeightChange = useCallback((nextBikeWeight: string) => {
    setBikeWeightStr(nextBikeWeight);
    localStorage.setItem("bikeWeight", nextBikeWeight);
  }, []);

  const closeInfoScreen = useCallback(async () => {
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
    filterPowerStr,
    handleBikeWeightChange,
    handleWeightChange,
    hideInfoScreenNextTime,
    openInfoScreen,
    setFilterPowerStr,
    setHideInfoScreenNextTime,
    setSidebarOpen,
    showInfoScreen,
    sidebarOpen,
    weightStr,
  };
}
