"use client";

import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/components/AuthContext";
import { useUiFeedback } from "@/components/ui/UiFeedbackProvider";
import HomeMapPanel from "@/components/home/HomeMapPanel";
import HomeOverlays from "@/components/home/HomeOverlays";
import HomeShell from "@/components/home/HomeShell";
import HomeSidebar from "@/components/home/HomeSidebar";
import { useDismissibleMenu } from "@/hooks/useDismissibleMenu";
import { useHomePreferences } from "@/hooks/useHomePreferences";
import { useHomeSegments } from "@/hooks/useHomeSegments";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { filterSegmentsByInterval } from "@/utils/intervals";

export default function Home() {
  const { user, token, isLoggedIn, login, logout, disconnect, isLoading: authLoading } = useAuth();
  const { confirm, showToast } = useUiFeedback();
  const isMobileViewport = useMobileViewport();

  const {
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
  } = useHomePreferences({
    authLoading,
    isLoggedIn,
    token,
    isMobileViewport,
    onPreferencePersistError: () => {
      showToast("Could not persist onboarding preference to your account.", { type: "error" });
    },
  });

  const { error, handleSegmentBlocked, handleSegmentRated, loading, reloadSegments, segments } = useHomeSegments();
  const [showSubmissionContent, setShowSubmissionContent] = useState(false);
  const [focusSegmentId, setFocusSegmentId] = useState<string | null>(null);
  const [focusSegmentNonce, setFocusSegmentNonce] = useState(0);

  // Filter state
  const [isFiltered, setIsFiltered] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { closeMenu: closeProfileMenu, isOpen: isProfileMenuOpen, menuRef: profileMenuRef, toggleMenu: toggleProfileMenu } =
    useDismissibleMenu<HTMLDivElement>();

  const filteredSegments = useMemo(() => {
    return filterSegmentsByInterval(segments, {
      isFiltered,
      filterPower: filterPowerStr,
      filterTimeMinutes: filterTimeStr,
      riderWeight: weightStr,
      bikeWeight: bikeWeightStr,
    });
  }, [segments, isFiltered, filterPowerStr, filterTimeStr, weightStr, bikeWeightStr]);

  const actorIdLabel = useMemo(() => {
    const actorId = user?.actor_id;
    if (!actorId) {
      return "User: unknown";
    }
    return `User: ${actorId.slice(0, 8)}`;
  }, [user?.actor_id]);

  const handleDisconnect = useCallback(async () => {
    const shouldDisconnect = await confirm({
      title: "Disconnect Strava?",
      description:
        "This will deauthenticate the app connection with Strava and permanently delete all your Where2Watt data. This includes any segments you've submitted, ratings you've made, and reports you've filed. This action cannot be undone.",
      confirmLabel: "Disconnect Strava and Delete Data",
      cancelLabel: "Cancel",
      tone: "danger",
    });
    if (!shouldDisconnect) {
      return;
    }

    setIsDisconnecting(true);
    try {
      await disconnect();
      showToast("Strava disconnected and local account data cleared.", { type: "success" });
    } catch (disconnectError) {
      const errorMessage =
        disconnectError instanceof Error ? disconnectError.message : "Failed to disconnect Strava right now.";
      showToast(errorMessage, { type: "error" });
    } finally {
      setIsDisconnecting(false);
    }
  }, [confirm, disconnect, showToast]);

  const handleExistingSegmentRated = useCallback(
    async (segmentId?: string) => {
      await reloadSegments();
      if (segmentId) {
        setFocusSegmentId(segmentId);
        setFocusSegmentNonce((previous) => previous + 1);
      }
    },
    [reloadSegments]
  );

  return (
    <HomeShell
      sidebarOpen={sidebarOpen}
      isMobileViewport={isMobileViewport}
      onToggleSidebar={() => setSidebarOpen((previous) => !previous)}
      onOpenInfoScreen={openInfoScreen}
    >
      <section className="absolute inset-0 bg-neutral-100/50" inert={isMobileViewport && sidebarOpen}>
        <HomeMapPanel
          error={error}
          loading={loading}
          totalSegmentsCount={segments.length}
          filteredSegments={filteredSegments}
          riderPower={filterPowerStr}
          riderWeight={weightStr}
          bikeWeight={bikeWeightStr}
          isFiltered={isFiltered}
          filterPower={filterPowerStr}
          filterTime={filterTimeStr}
          onSegmentBlocked={handleSegmentBlocked}
          onSegmentRated={handleSegmentRated}
          focusSegmentId={focusSegmentId}
          focusSegmentNonce={focusSegmentNonce}
          sidebarOpen={sidebarOpen}
        />

        <HomeOverlays
          showSubmissionContent={showSubmissionContent}
          showInfoScreen={showInfoScreen}
          hideInfoScreenNextTime={hideInfoScreenNextTime}
          onCloseSubmission={() => setShowSubmissionContent(false)}
          onExistingSegmentRated={handleExistingSegmentRated}
          onHideInfoScreenNextTimeChange={setHideInfoScreenNextTime}
          onContinueInfo={closeInfoScreen}
        />
      </section>

      <HomeSidebar
        auth={{
          loading: authLoading,
          isLoggedIn,
          actorIdLabel,
          isDisconnecting,
          isProfileMenuOpen,
          userPresent: Boolean(user),
        }}
        filter={{
          isFiltered,
          matchingSegmentsCount: filteredSegments.length,
          totalSegmentsCount: segments.length,
          preferencesReady,
          weightStr,
          bikeWeightStr,
          filterPowerStr,
          filterTimeStr,
        }}
        actions={{
          onApplyFilter: () => setIsFiltered(true),
          onBikeWeightChange: handleBikeWeightChange,
          onDisconnect: () => {
            closeProfileMenu();
            void handleDisconnect();
          },
          onFilterPowerChange: handleFilterPowerChange,
          onFilterTimeChange: handleFilterTimeChange,
          onLogin: login,
          onLogout: () => {
            closeProfileMenu();
            logout();
          },
          onResetFilter: () => setIsFiltered(false),
          onSubmitSegment: () => setShowSubmissionContent(true),
          onToggleProfileMenu: toggleProfileMenu,
          onWeightChange: handleWeightChange,
        }}
        profileMenuRef={profileMenuRef}
        sidebarOpen={sidebarOpen}
      />
    </HomeShell>
  );
}
