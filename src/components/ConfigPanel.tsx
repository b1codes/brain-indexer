import { Folder, BookOpen, RefreshCw, Play } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks.ts';
import { setVaultPath, setOutDir, pickFolderThunk, scanProjectsThunk } from '../store/appSlice.ts';

export const ConfigPanel = () => {
  const dispatch = useAppDispatch();
  const { vaultPath, outDir, isLoading } = useAppSelector((state) => state.app);

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Vault Configuration</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Point Brain Indexer to your Obsidian vault directory and stage dropzone to begin.</p>
      </div>

      <div className="glass-panel" style={{ padding: '32px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bg-surface)' }}>
        <div className="form-group">
          <label className="form-label">Obsidian Vault Folder Path</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              value={vaultPath}
              onChange={(e) => dispatch(setVaultPath(e.target.value))}
              placeholder="e.g. /Users/username/Obsidian/SecondBrain"
              className="form-input"
            />
            <button className="btn btn-secondary" onClick={() => dispatch(pickFolderThunk('vault'))}>
              <Folder size={18} />
              <span>Browse</span>
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">NotebookLM Staging Dropzone (e.g. Google Drive Dropzone)</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              value={outDir}
              onChange={(e) => dispatch(setOutDir(e.target.value))}
              placeholder="e.g. /Users/username/GoogleDrive/Dropzone"
              className="form-input"
            />
            <button className="btn btn-secondary" onClick={() => dispatch(pickFolderThunk('out'))}>
              <Folder size={18} />
              <span>Browse</span>
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {vaultPath && (
            <button className="btn btn-primary" onClick={() => dispatch(scanProjectsThunk())} disabled={isLoading}>
              {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />}
              <span>Scan Vault & Open Workspace</span>
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ marginTop: '24px', padding: '24px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '16px', borderLeft: '4px solid var(--primary)', background: 'rgba(139,92,246,0.05)' }}>
        <BookOpen size={24} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <div>
          <h4 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '4px' }}>The PARA Method Alignment</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Brain Indexer expects your Obsidian vault to contain folders matching standard PARA naming: <b>01_Projects</b>, <b>02_Areas</b>, <b>03_Resources</b>, and <b>04_Archives</b>. Make sure these folders are present in your vault root.</p>
        </div>
      </div>
    </div>
  );
};
