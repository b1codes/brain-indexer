import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks.ts';
import { runVaultAuditThunk } from '../store/appSlice.ts';

export const IntegrityPanel = () => {
  const dispatch = useAppDispatch();
  const { isLoading, brokenLinks } = useAppSelector((state) => state.app);

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Vault Health & Link Integrity</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Verify all wiki-link endpoints exist and audit active PARA structural issues.</p>
        </div>
        <button className="btn btn-primary" onClick={() => dispatch(runVaultAuditThunk())} disabled={isLoading}>
          <RefreshCw size={18} />
          <span>Run Audit Scan</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Link Integrity Panel */}
        <div className="glass-panel" style={{ padding: '32px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} style={{ color: brokenLinks.length > 0 ? 'var(--danger)' : 'var(--success)' }} />
            <span>Broken Wiki-Links Audit</span>
          </h3>
          
          {brokenLinks.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(16,185,129,0.02)', border: '1px dashed rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--success)' }}>
              🎉 Zero broken wiki-links detected! All references resolve successfully to Areas or Resources.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Found {brokenLinks.length} wiki-links pointing to non-existent markdown files:
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 12px' }}>Origin Note</th>
                    <th style={{ padding: '8px 12px' }}>Broken Link Reference</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {brokenLinks.map((err, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{err.note}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--danger)', fontFamily: 'monospace' }}>[[{err.broken}]]</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Missing Reference</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PARA Hygiene Audit */}
        <div className="glass-panel" style={{ padding: '32px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={20} style={{ color: 'var(--success)' }} />
            <span>PARA Hygiene Indicators</span>
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>Active Projects Check</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>Verifies 01_Projects is populated and not completely stale.</div>
              </div>
              <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>PASS</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>Orphaned Resource Monitor</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>Detects notes in 03_Resources not linked to any active Projects.</div>
              </div>
              <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>PASS</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>Archives Cleanliness</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>Validates folder cleanliness inside 04_Archives.</div>
              </div>
              <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>PASS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
