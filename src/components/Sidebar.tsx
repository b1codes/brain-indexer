import { Settings, Layers, Activity, Terminal } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks.ts';
import { setActiveTab } from '../store/appSlice.ts';

export const Sidebar = () => {
  const dispatch = useAppDispatch();
  const { activeTab, vaultPath, consoleLogs } = useAppSelector((state) => state.app);

  return (
    <aside className="glass-panel" style={{ width: '280px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, var(--primary), #3b82f6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '18px', boxShadow: '0 0 15px rgba(139,92,246,0.3)' }}>
            🧠
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>Brain Indexer</h1>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>PARA staging command center</span>
          </div>
        </div>
      </div>

      <nav style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <button 
          className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ justifyContent: 'flex-start', width: '100%' }}
          onClick={() => dispatch(setActiveTab('config'))}
        >
          <Settings size={18} />
          <span>Vault Configuration</span>
        </button>

        <button 
          className={`btn ${activeTab === 'workspace' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ justifyContent: 'flex-start', width: '100%' }}
          disabled={!vaultPath}
          onClick={() => dispatch(setActiveTab('workspace'))}
        >
          <Layers size={18} />
          <span>Staging Workspace</span>
        </button>

        <button 
          className={`btn ${activeTab === 'integrity' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ justifyContent: 'flex-start', width: '100%' }}
          disabled={!vaultPath}
          onClick={() => dispatch(setActiveTab('integrity'))}
        >
          <Activity size={18} />
          <span>Vault Health Auditor</span>
        </button>
      </nav>

      <div style={{ borderTop: '1px solid var(--border-color)', height: '240px', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <Terminal size={14} />
          <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Console Logs</span>
        </div>
        <div style={{ padding: '12px 16px', overflowY: 'auto', flex: 1, fontSize: '11px', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {consoleLogs.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>Idle. Waiting for actions...</span>
          ) : (
            consoleLogs.map((log, idx) => (
              <div key={idx} style={{ color: log.type === 'error' ? 'var(--danger)' : log.type === 'success' ? 'var(--success)' : 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>[{log.timestamp}]</span>
                {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};
