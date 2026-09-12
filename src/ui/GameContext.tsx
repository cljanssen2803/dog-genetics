/**
 * Shared game state for the whole interface.
 *
 * The engine deliberately changes a project in place (it is a big object and
 * copying it every turn would be wasteful on a phone). React does not notice
 * in-place changes, so after anything that alters the world we call `refresh`,
 * which bumps a counter and re-renders. `refresh` also schedules an autosave.
 */

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Project } from '../game/project';
import { saveProject } from '../game/storage';
import { assessEstablishment } from '../game/analytics';

interface GameContextValue {
  project: Project;
  /** Call after any change to the project. */
  refresh: () => void;
  /** Show a short message at the bottom of the screen. */
  say: (message: string) => void;
  nerdMode: boolean;
  setNerdMode: (on: boolean) => void;
  /** Increments on every refresh; useful as a dependency for memos. */
  version: number;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({
  project,
  children,
  onToast,
}: {
  project: Project;
  children: ReactNode;
  onToast: (message: string) => void;
}) {
  const [version, setVersion] = useState(0);
  const saveTimer = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);

    // Autosave, but not on every single keystroke — wait for a quiet moment.
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const status = assessEstablishment(project);
      void saveProject(project, status.standardisation);
    }, 700);
  }, [project]);

  // Make sure the last change is written if the player closes the app.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      void saveProject(project, assessEstablishment(project).standardisation);
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    return () => {
      window.removeEventListener('pagehide', flush);
    };
  }, [project]);

  const setNerdMode = useCallback(
    (on: boolean) => {
      project.nerdMode = on;
      refresh();
    },
    [project, refresh],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      project,
      refresh,
      say: onToast,
      nerdMode: project.nerdMode,
      setNerdMode,
      version,
    }),
    [project, refresh, onToast, setNerdMode, version],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used inside a GameProvider');
  return context;
}
