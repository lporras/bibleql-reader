import type { JSX } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppStateProvider } from "./state/AppStateContext";
import { AnnotationsProvider } from "./state/AnnotationsContext";
import { OfflineDownloadsProvider } from "./state/OfflineDownloadsContext";
import { StudiesProvider } from "./state/StudiesContext";
import { AiChatProvider } from "./state/AiChatContext";
import { RootRedirect } from "./routes/RootRedirect";
import { ReaderPage } from "./routes/ReaderPage";
import { ImageCreatorPage } from "./routes/ImageCreatorPage";
import { StudyPage, StudyRedirect } from "./routes/StudyPage";

export default function App(): JSX.Element {
  return (
    <AppStateProvider>
      <AnnotationsProvider>
        <OfflineDownloadsProvider>
          <StudiesProvider>
            <AiChatProvider>
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/read/:bookId/:chapter" element={<ReaderPage />} />
                <Route path="/read/:bookId/:chapter/:panel" element={<ReaderPage />} />
                <Route path="/create" element={<ImageCreatorPage />} />
                <Route path="/study" element={<StudyRedirect />} />
                <Route path="/study/:id" element={<StudyPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AiChatProvider>
          </StudiesProvider>
        </OfflineDownloadsProvider>
      </AnnotationsProvider>
    </AppStateProvider>
  );
}
