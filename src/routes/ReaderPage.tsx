import { useEffect, useState, type JSX } from "react";
import { useParams } from "react-router-dom";
import { useAppState } from "../state/AppStateContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { writeLastLocation } from "../state/persist";
import { TitleBar } from "../components/TitleBar/TitleBar";
import { Sidebar } from "../components/Sidebar/Sidebar";
import { SidebarDrawer } from "../components/Sidebar/SidebarDrawer";
import { ReaderPane } from "../components/Reader/ReaderPane";
import { StudyPanel } from "../components/StudyPanel/StudyPanel";
import { KeyDialog } from "../components/KeyDialog";
import { StatusBar } from "../components/StatusBar";
import styles from "./ReaderPage.module.scss";

// The route composition layer only — every child pulls its own preferences
// (useAppState), server data (react-query hooks) and location (useParams /
// useSearchParams) directly, so this stays a thin shell rather than a
// second renderVals()-style monolith.
export function ReaderPage(): JSX.Element {
  const { bookId = "PSA", chapter: chapterParam } = useParams();
  const chapter = Number(chapterParam) || 1;
  const { state } = useAppState();
  const { panelEff, showSidebar, compareEff } = useResponsiveLayout(state.panelOpen, state.compare);
  const [navOpen, setNavOpen] = useState(false);

  // Rotating to a width where the sidebar fits as a column shuts the drawer, so
  // it doesn't pop back open on the next rotation to portrait.
  useEffect(() => {
    if (showSidebar) setNavOpen(false);
  }, [showSidebar]);

  useEffect(() => {
    writeLastLocation({ bookId, chapter });
  }, [bookId, chapter]);

  return (
    <div className={styles.shell}>
      <TitleBar showOffline={!showSidebar} />
      <div className={styles.body}>
        {showSidebar && <Sidebar />}
        <ReaderPane
          compareEff={compareEff}
          nav={showSidebar ? undefined : { open: navOpen, onOpen: () => setNavOpen(true) }}
        />
        {panelEff && <StudyPanel />}
      </div>
      <StatusBar />
      {!showSidebar && <SidebarDrawer open={navOpen} onClose={() => setNavOpen(false)} />}
      {state.keyDialogOpen && <KeyDialog />}
    </div>
  );
}
