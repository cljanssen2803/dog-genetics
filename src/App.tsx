/**
 * Top level: decides whether we are looking at the project list, the new
 * project wizard, or a game in progress.
 */

import { useCallback, useEffect, useState } from 'react';
import { Toast } from './ui/components';
import { SpriteFilters } from './ui/DogSprite';
import { GameProvider } from './ui/GameContext';
import { Home } from './ui/screens/Home';
import { NewProject } from './ui/screens/NewProject';
import { Game } from './ui/screens/Game';
import { Lab } from './ui/screens/Lab';
import { Playground } from './ui/screens/Playground';
import type { Project } from './game/project';
import { loadProject, loadSettings, saveSettings } from './game/storage';

type Route = { name: 'home' } | { name: 'new' } | { name: 'lab' } | { name: 'playground' } | { name: 'game'; project: Project };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [toast, setToast] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  // On first load, reopen whatever project was last being played.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const settings = await loadSettings();
      if (settings.lastProjectId) {
        const project = await loadProject(settings.lastProjectId);
        if (project && !cancelled) {
          setRoute({ name: 'game', project });
        }
      }
      if (!cancelled) setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const open = useCallback(async (id: string) => {
    const project = await loadProject(id);
    if (!project) {
      setToast('That project could not be opened.');
      return;
    }
    const settings = await loadSettings();
    await saveSettings({ ...settings, lastProjectId: id });
    setRoute({ name: 'game', project });
  }, []);

  const exit = useCallback(async () => {
    const settings = await loadSettings();
    await saveSettings({ ...settings, lastProjectId: undefined });
    setRoute({ name: 'home' });
  }, []);

  const say = useCallback((message: string) => setToast(message), []);

  if (booting) {
    return (
      <div className="paper min-h-full flex items-center justify-center">
        <div className="text-[14px] text-[var(--text-faint)]">Loading…</div>
      </div>
    );
  }

  return (
    <>
      <SpriteFilters />
      {route.name === 'home' && (
        <Home
          onOpen={(id) => void open(id)}
          onNew={() => setRoute({ name: 'new' })}
          onLab={() => setRoute({ name: 'lab' })}
          onPlayground={() => setRoute({ name: 'playground' })}
        />
      )}

      {route.name === 'new' && (
        <NewProject
          onCreated={(id) => void open(id)}
          onCancel={() => setRoute({ name: 'home' })}
          onLab={() => setRoute({ name: 'lab' })}
        />
      )}

      {route.name === 'playground' && (
        <Playground onBack={() => setRoute({ name: 'home' })} onCreated={(id) => void open(id)} onToast={say} />
      )}

      {route.name === 'lab' && (
        <Lab onBack={() => setRoute({ name: 'home' })} onCreated={(id) => void open(id)} />
      )}

      {route.name === 'game' && (
        <GameProvider key={route.project.id} project={route.project} onToast={say}>
          <Game onExit={() => void exit()} />
        </GameProvider>
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
