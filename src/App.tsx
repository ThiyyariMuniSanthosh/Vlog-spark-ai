import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudioProvider, useStudio } from './context/StudioContext';
import { StudioLayout } from './components/StudioLayout';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { GeneratorPage } from './pages/GeneratorPage';
import { ScriptEditorPage } from './pages/ScriptEditorPage';
import { SpeakingGuidePage } from './pages/SpeakingGuidePage';
import { ScenePlannerPage } from './pages/ScenePlannerPage';
import { VisualStudioPage } from './pages/VisualStudioPage';
import { VoiceStudioPage } from './pages/VoiceStudioPage';
import { VideoEditorPage } from './pages/VideoEditorPage';
import { CaptionsStudioPage } from './pages/CaptionsStudioPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ExportCenterPage } from './pages/ExportCenterPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpTutorialsPage } from './pages/HelpTutorialsPage';

function AppRouter() {
  const { authReady, user, currentPage, navigate } = useStudio();
  const [quickTopic, setQuickTopic] = useState<string>('');

  if (!authReady) {
    return (
      <div className="min-h-screen studio-canvas-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          <p className="text-xs font-medium">Loading VlogSpark AI 2.0...</p>
        </div>
      </div>
    );
  }

  if (currentPage === 'landing') {
    return <LandingPage />;
  }

  if (currentPage === 'auth') {
    return <AuthPage />;
  }

  if (currentPage === 'help' && !user) {
    return <HelpTutorialsPage />;
  }

  // Protected Studio Pages
  if (!user) {
    return <AuthPage />;
  }

  const handleQuickStartTopic = (topic: string) => {
    setQuickTopic(topic);
    navigate('generator');
  };

  return (
    <StudioLayout>
      {currentPage === 'dashboard' && (
        <DashboardPage onQuickStartTopic={handleQuickStartTopic} />
      )}
      {currentPage === 'generator' && (
        <GeneratorPage
          initialTopic={quickTopic}
          onClearInitialTopic={() => setQuickTopic('')}
        />
      )}
      {currentPage === 'script' && <ScriptEditorPage />}
      {currentPage === 'speaking' && <SpeakingGuidePage />}
      {currentPage === 'scenes' && <ScenePlannerPage />}
      {currentPage === 'visuals' && <VisualStudioPage />}
      {currentPage === 'voice' && <VoiceStudioPage />}
      {currentPage === 'editor' && <VideoEditorPage />}
      {currentPage === 'captions' && <CaptionsStudioPage />}
      {currentPage === 'projects' && <ProjectsPage />}
      {currentPage === 'export' && <ExportCenterPage />}
      {currentPage === 'settings' && <SettingsPage />}
      {currentPage === 'help' && <HelpTutorialsPage />}
    </StudioLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StudioProvider>
        <AppRouter />
      </StudioProvider>
    </ErrorBoundary>
  );
}
