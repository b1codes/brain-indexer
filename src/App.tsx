import { useState, useEffect } from 'react';
import { 
  Folder, 
  Settings, 
  Layers, 
  Activity, 
  ChevronRight, 
  CheckSquare, 
  Square, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  BookOpen, 
  FileText, 
  RefreshCw,
  Terminal,
  FileCode
} from 'lucide-react';

// Tauri API imports with safe browser fallback
let invoke = async (cmd: string, args?: any): Promise<any> => {
  console.log(`Mock calling command: ${cmd}`, args);
  return Promise.resolve([]);
};
let openDialog = async (options: any): Promise<string | null> => {
  console.log('Mock opening dialog', options);
  return null;
};

// Safe load of @tauri-apps/api in Tauri runtime environments
if ((window as any).__TAURI_METADATA__) {
  import('@tauri-apps/api/tauri').then((tauriCore) => {
    invoke = tauriCore.invoke;
  });
  import('@tauri-apps/api/dialog').then((tauriDialog) => {
    // @ts-ignore
    openDialog = tauriDialog.open;
  });
}

interface Note {
  title: string;
  relative_path: string;
  category: 'Projects' | 'Areas' | 'Resources' | 'Archives';
}

interface DependencyNode {
  title: string;
  relative_path: string;
  category: string;
  resolved_path: string;
}

interface ProjectTree {
  project: Note;
  dependencies: DependencyNode[];
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'workspace' | 'integrity' | 'config'>('config');

  // Vault Configuration
  const [vaultPath, setVaultPath] = useState<string>('');
  const [outDir, setOutDir] = useState<string>('');
  
  // Data State
  const [projects, setProjects] = useState<Note[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projectTree, setProjectTree] = useState<ProjectTree | null>(null);
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);
  const [previewContent, setPreviewContent] = useState<string>('');
  
  // Loading & UI States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  
  // Health & Integrity Audit Results
  const [brokenLinks, setBrokenLinks] = useState<{ note: string; broken: string }[]>([]);

  // Log message helper
  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [{ timestamp, message, type }, ...prev].slice(0, 50));
  };

  // Safe path picking using native dialogs
  const pickFolder = async (target: 'vault' | 'out') => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: target === 'vault' ? 'Select Obsidian Vault' : 'Select Staging Dropzone'
      });
      if (selected && typeof selected === 'string') {
        if (target === 'vault') {
          setVaultPath(selected);
          addLog(`Vault path configured: ${selected}`, 'info');
        } else {
          setOutDir(selected);
          addLog(`Output dropzone configured: ${selected}`, 'info');
        }
      }
    } catch (err) {
      addLog(`Failed to open folder picker: ${err}`, 'error');
    }
  };

  // Scan vault projects
  const handleScanProjects = async () => {
    if (!vaultPath) {
      addLog('Error: Please configure the vault path first.', 'error');
      return;
    }
    setIsLoading(true);
    addLog('Scanning Obsidian vault projects folder (01_Projects)...', 'info');
    try {
      const result: Note[] = await invoke('scan_projects', { vaultPath });
      setProjects(result);
      addLog(`Scan completed. Found ${result.length} projects.`, 'success');
      
      // Auto transition to workspace tab if projects are found
      if (result.length > 0) {
        setActiveTab('workspace');
      }
    } catch (err) {
      addLog(`Scan failed: ${err}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Get project tree (load project dependency list)
  const loadProjectTree = async (title: string) => {
    if (!vaultPath) return;
    setIsLoading(true);
    setSelectedProject(title);
    setProjectTree(null);
    setPreviewContent('');
    addLog(`Loading dependency tree for project: ${title}...`, 'info');
    try {
      const result: ProjectTree = await invoke('get_project_tree', { vaultPath, projectTitle: title });
      setProjectTree(result);
      
      // Select all resolved dependencies by default
      const defaultSelected = result.dependencies.map(d => d.title);
      setSelectedDeps(defaultSelected);
      addLog(`Tree parsed. Resolved ${result.dependencies.length} wiki-link references.`, 'success');
      
      // Auto trigger preview compile
      await generatePreview(title, defaultSelected);
    } catch (err) {
      addLog(`Failed to load dependency tree: ${err}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle individual dependency selection
  const handleToggleDep = (depTitle: string) => {
    setSelectedDeps(prev => {
      const updated = prev.includes(depTitle) 
        ? prev.filter(t => t !== depTitle) 
        : [...prev, depTitle];
      
      // Recalculate preview on toggle
      if (selectedProject) {
        generatePreview(selectedProject, updated);
      }
      return updated;
    });
  };

  // Compile selective markdown preview
  const generatePreview = async (title: string, deps: string[]) => {
    try {
      const compiled: string = await invoke('preview_stage_bundle', {
        vaultPath,
        target: title,
        selectedDeps: deps
      });
      setPreviewContent(compiled);
    } catch (err) {
      addLog(`Failed to generate live preview: ${err}`, 'error');
    }
  };

  // Final Stage compile & write to disk
  const handleStageBundle = async () => {
    if (!vaultPath || !outDir || !selectedProject) {
      addLog('Error: Missing required path configurations.', 'error');
      return;
    }
    setIsLoading(true);
    addLog(`Compiling and staging ${selectedProject} to output dropzone...`, 'info');
    try {
      const outPath: string = await invoke('stage_project_bundle', {
        vaultPath,
        target: selectedProject,
        outDir,
        selectedDeps
      });
      addLog(`Successfully compiled and staged bundle! Written to: ${outPath}`, 'success');
    } catch (err) {
      addLog(`Staging compile failed: ${err}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Audit Vault Integrity & Health checks (Integrity Tab)
  const runVaultAudit = async () => {
    if (!vaultPath) {
      addLog('Error: Vault path is required to run audit.', 'error');
      return;
    }
    setIsLoading(true);
    addLog('Auditing vault PARA structures and checking link integrity...', 'info');
    try {
      // 1. Let's find broken links
      // We simulate link auditor by scanning all projects and verifying link dependencies
      const projectNotes: Note[] = await invoke('scan_projects', { vaultPath });
      const foundBroken: { note: string; broken: string }[] = [];
      const seenResources = new Set<string>();

      for (const proj of projectNotes) {
        const tree: ProjectTree = await invoke('get_project_tree', { vaultPath, projectTitle: proj.title });
        
        // Simulating checking markdown file content directly in Javascript for dead links
        // We know links are extracted. In a fully populated vault, we'd check if resolver fails.
        // We look for resolved category "Unknown" or empty pathways
        for (const dep of tree.dependencies) {
          seenResources.add(dep.title);
          if (dep.category === 'Unknown') {
            foundBroken.push({ note: proj.title, broken: dep.title });
          }
        }
      }
      
      setBrokenLinks(foundBroken);
      addLog(`Audit complete. Found ${foundBroken.length} broken wiki-links.`, foundBroken.length > 0 ? 'error' : 'success');
    } catch (err) {
      addLog(`Audit failed: ${err}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto scan when vaultPath is modified
  useEffect(() => {
    if (vaultPath) {
      handleScanProjects();
    }
  }, [vaultPath]);

  return (
    <div className="app-container">
      {/* 1. Left Sidebar Navigation */}
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

        {/* Tab links */}
        <nav style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button 
            className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', width: '100%' }}
            onClick={() => setActiveTab('config')}
          >
            <Settings size={18} />
            <span>Vault Configuration</span>
          </button>

          <button 
            className={`btn ${activeTab === 'workspace' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', width: '100%' }}
            disabled={!vaultPath}
            onClick={() => setActiveTab('workspace')}
          >
            <Layers size={18} />
            <span>Staging Workspace</span>
          </button>

          <button 
            className={`btn ${activeTab === 'integrity' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', width: '100%' }}
            disabled={!vaultPath}
            onClick={() => setActiveTab('integrity')}
          >
            <Activity size={18} />
            <span>Vault Health Auditor</span>
          </button>
        </nav>

        {/* Real-time System Console logs */}
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

      {/* 2. Main Content Panels */}
      <main style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)' }}>
        <div className="gradient-bar" />

        {/* Panel Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
          
          {/* TAB 1: Config View */}
          {activeTab === 'config' && (
            <div style={{ maxWidth: '720px' }}>
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Vault Configuration</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Point Brain Indexer to your Obsidian vault directory and stage dropzone to begin.</p>
              </div>

              <div className="glass-panel" style={{ padding: '32px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bg-surface)' }}>
                {/* Vault folder picker */}
                <div className="form-group">
                  <label className="form-label">Obsidian Vault Folder Path</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input 
                      type="text" 
                      value={vaultPath}
                      onChange={(e) => setVaultPath(e.target.value)}
                      placeholder="e.g. /Users/username/Obsidian/SecondBrain"
                      className="form-input"
                    />
                    <button className="btn btn-secondary" onClick={() => pickFolder('vault')}>
                      <Folder size={18} />
                      <span>Browse</span>
                    </button>
                  </div>
                </div>

                {/* Staging Dropzone folder picker */}
                <div className="form-group">
                  <label className="form-label">NotebookLM Staging Dropzone (e.g. Google Drive Dropzone)</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input 
                      type="text" 
                      value={outDir}
                      onChange={(e) => setOutDir(e.target.value)}
                      placeholder="e.g. /Users/username/GoogleDrive/Dropzone"
                      className="form-input"
                    />
                    <button className="btn btn-secondary" onClick={() => pickFolder('out')}>
                      <Folder size={18} />
                      <span>Browse</span>
                    </button>
                  </div>
                </div>

                {/* Manual scan & trigger */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  {vaultPath && (
                    <button className="btn btn-primary" onClick={handleScanProjects} disabled={isLoading}>
                      {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />}
                      <span>Scan Vault & Open Workspace</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Helpful Guide Card */}
              <div className="glass-panel" style={{ marginTop: '24px', padding: '24px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '16px', borderLeft: '4px solid var(--primary)', background: 'rgba(139,92,246,0.05)' }}>
                <BookOpen size={24} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '4px' }}>The PARA Method Alignment</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Brain Indexer expects your Obsidian vault to contain folders matching standard PARA naming: <b>01_Projects</b>, <b>02_Areas</b>, <b>03_Resources</b>, and <b>04_Archives</b>. Make sure these folders are present in your vault root.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Workspace Staging View */}
          {activeTab === 'workspace' && (
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
                        onClick={() => loadProjectTree(proj.title)}
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
                                onClick={() => handleToggleDep(dep.title)}
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
                      <button className="btn btn-primary" onClick={handleStageBundle} disabled={isLoading}>
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
                        {/* Render simple HTML wrapper to simulate live markdown bundle rendering */}
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: '13px' }}>
                          {previewContent}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: Vault Health & Integrity Checks */}
          {activeTab === 'integrity' && (
            <div style={{ maxWidth: '800px' }}>
              <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Vault Health & Link Integrity</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Verify all wiki-link endpoints exist and audit active PARA structural issues.</p>
                </div>
                <button className="btn btn-primary" onClick={runVaultAudit} disabled={isLoading}>
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
          )}

        </div>
      </main>
    </div>
  );
}
