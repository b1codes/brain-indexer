import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './store/hooks.ts';
import { scanProjectsThunk } from './store/appSlice.ts';

// Refactored Component Imports
import { Sidebar } from './components/Sidebar.tsx';
import { ConfigPanel } from './components/ConfigPanel.tsx';
import { WorkspacePanel } from './components/WorkspacePanel.tsx';
import { IntegrityPanel } from './components/IntegrityPanel.tsx';

export default function App() {
  const dispatch = useAppDispatch();
  const { activeTab, vaultPath } = useAppSelector((state) => state.app);

  // Auto scan when vaultPath is modified
  useEffect(() => {
    if (vaultPath) {
      dispatch(scanProjectsThunk());
    }
  }, [vaultPath, dispatch]);

  return (
    <div className="app-container">
      {/* Sidebar Navigation & Console */}
      <Sidebar />

      {/* Main Content Panels */}
      <main style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)' }}>
        <div className="gradient-bar" />

        <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
          {activeTab === 'config' && <ConfigPanel />}
          {activeTab === 'workspace' && <WorkspacePanel />}
          {activeTab === 'integrity' && <IntegrityPanel />}
        </div>
      </main>
    </div>
  );
}
