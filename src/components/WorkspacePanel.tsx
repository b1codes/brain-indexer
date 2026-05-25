import { 
  FileCode, 
  ChevronRight, 
  FileText, 
  CheckSquare, 
  Square, 
  CheckCircle 
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks.ts';
import { loadProjectTreeThunk, toggleDependencyThunk, stageBundleThunk } from '../store/appSlice.ts';

export const WorkspacePanel = () => {
  const dispatch = useAppDispatch();
  const {
    projects,
    selectedProject,
    projectTree,
    selectedDeps,
    outDir,
    isLoading,
    previewContent
  } = useAppSelector((state) => state.app);

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 120px)' }}>
      {/* Projects side drawer */}
      <div className="glass-panel" style={{ width: '280px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileCode size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.02em' }}>PARA Projects</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projects.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No projects scanned. Go back to Configuration to scan.
            </div>
          ) : (
            projects.map((proj) => (
              <button
                key={proj.title}
                onClick={() => dispatch(loadProjectTreeThunk(proj.title))}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid',
                  borderColor: selectedProject === proj.title ? 'var(--primary)' : 'var(--border-color)',
                  background: selectedProject === proj.title ? 'rgba(139,92,246,0.08)' : 'rgba(8,12,20,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: selectedProject === proj.title ? 'var(--primary)' : 'var(--text-primary)' }}>{proj.title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', wordBreak: 'break-all' }}>{proj.relative_path}</div>
                </div>
                <ChevronRight size={14} style={{ color: selectedProject === proj.title ? 'var(--primary)' : 'var(--text-muted)' }} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main working panels: dependency tree & preview */}
      <div style={{ flex: 1, display: 'flex', gap: '24px', height: '100%' }}>
        
        {/* Dependency Panel */}
        <div className="glass-panel" style={{ flex: 1.2, borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Wiki-link References</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Toggle checkboxes to cherry-pick linked notes for staging</span>
            </div>
            {projectTree && (
              <span style={{ fontSize: '11px', background: 'var(--bg-surface-elevated)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                Resolved: {projectTree.dependencies.length}
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!projectTree ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <FileText size={48} style={{ marginBottom: '16px', strokeWidth: 1 }} />
                <span>Select a project from the sidebar to inspect its links</span>
              </div>
            ) : (
              <>
                {/* Project Card */}
                <div style={{ padding: '16px', background: 'rgba(8,12,20,0.4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ background: 'rgba(139,92,246,0.1)', padding: '8px', borderRadius: '8px', color: 'var(--primary)' }}>
                    🧠
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>ROOT PROJECT NOTE</div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{projectTree.project.title}</div>
                  </div>
                </div>

                {/* Link nodes list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Linked Dependencies</div>
                  
                  {projectTree.dependencies.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(8,12,20,0.2)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                      No wiki-links found in this project note.
                    </div>
                  ) : (
                    projectTree.dependencies.map((dep) => (
                      <div
                        key={dep.title}
                        onClick={() => dispatch(toggleDependencyThunk(dep.title))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: selectedDeps.includes(dep.title) ? 'rgba(255,255,255,0.02)' : 'rgba(8,12,20,0.2)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid',
                          borderColor: selectedDeps.includes(dep.title) ? 'rgba(139,92,246,0.2)' : 'var(--border-color)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {selectedDeps.includes(dep.title) ? (
                            <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
                          ) : (
                            <Square size={18} style={{ color: 'var(--text-muted)' }} />
                          )}
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: selectedDeps.includes(dep.title) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{dep.title}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{dep.relative_path}</div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: dep.category === 'Areas' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                          color: dep.category === 'Areas' ? '#3b82f6' : '#10b981',
                          border: '1px solid',
                          borderColor: dep.category === 'Areas' ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)'
                        }}>
                          {dep.category}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Markdown Preview & Staging compile action */}
        <div className="glass-panel" style={{ flex: 1.5, borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Study Guide Preview</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Interactive preview of the staged output</span>
            </div>
            {projectTree && outDir && (
              <button className="btn btn-primary" onClick={() => dispatch(stageBundleThunk())} disabled={isLoading}>
                <CheckCircle size={16} />
                <span>Stage Bundle</span>
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'rgba(8,12,20,0.3)', color: 'var(--text-secondary)' }}>
            {!previewContent ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <FileText size={48} style={{ marginBottom: '16px', strokeWidth: 1 }} />
                <span>Stage preview is currently empty</span>
              </div>
            ) : (
              <div className="markdown-body" style={{ fontSize: '13px' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: '13px' }}>
                  {previewContent}
                </pre>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
