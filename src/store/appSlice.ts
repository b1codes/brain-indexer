import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { invoke, openDialog } from './tauriBridge.ts';
import type { RootState } from './index.ts';

export interface Note {
  title: string;
  relative_path: string;
  category: 'Projects' | 'Areas' | 'Resources' | 'Archives';
}

export interface DependencyNode {
  title: string;
  relative_path: string;
  category: string;
  resolved_path: string;
}

export interface ProjectTree {
  project: Note;
  dependencies: DependencyNode[];
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export interface AppState {
  activeTab: 'workspace' | 'integrity' | 'config';
  vaultPath: string;
  outDir: string;
  projects: Note[];
  selectedProject: string;
  projectTree: ProjectTree | null;
  selectedDeps: string[];
  previewContent: string;
  isLoading: boolean;
  consoleLogs: LogEntry[];
  brokenLinks: { note: string; broken: string }[];
}

const initialState: AppState = {
  activeTab: 'config',
  vaultPath: '',
  outDir: '',
  projects: [],
  selectedProject: '',
  projectTree: null,
  selectedDeps: [],
  previewContent: '',
  isLoading: false,
  consoleLogs: [],
  brokenLinks: [],
};

// --- ASYNCHRONOUS THUNKS ---

// Pick vault or staging folder
export const pickFolderThunk = createAsyncThunk<void, 'vault' | 'out', { state: RootState }>(
  'app/pickFolder',
  async (target, { dispatch }) => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: target === 'vault' ? 'Select Obsidian Vault' : 'Select Staging Dropzone'
      });
      if (selected && typeof selected === 'string') {
        if (target === 'vault') {
          dispatch(setVaultPath(selected));
          dispatch(addLog({ message: `Vault path configured: ${selected}`, type: 'info' }));
        } else {
          dispatch(setOutDir(selected));
          dispatch(addLog({ message: `Output dropzone configured: ${selected}`, type: 'info' }));
        }
      }
    } catch (err) {
      dispatch(addLog({ message: `Failed to open folder picker: ${err}`, type: 'error' }));
    }
  }
);

// Scan projects inside the vault
export const scanProjectsThunk = createAsyncThunk<void, void, { state: RootState }>(
  'app/scanProjects',
  async (_, { getState, dispatch }) => {
    const { vaultPath } = getState().app;
    if (!vaultPath) {
      dispatch(addLog({ message: 'Error: Please configure the vault path first.', type: 'error' }));
      return;
    }
    dispatch(setIsLoading(true));
    dispatch(addLog({ message: 'Scanning Obsidian vault projects folder (01_Projects)...', type: 'info' }));
    try {
      const result: Note[] = await invoke('scan_projects', { vaultPath });
      dispatch(setProjects(result));
      dispatch(addLog({ message: `Scan completed. Found ${result.length} projects.`, type: 'success' }));
      
      if (result.length > 0) {
        dispatch(setActiveTab('workspace'));
      }
    } catch (err) {
      dispatch(addLog({ message: `Scan failed: ${err}`, type: 'error' }));
    } finally {
      dispatch(setIsLoading(false));
    }
  }
);

// Load dependency tree for a selected project
export const loadProjectTreeThunk = createAsyncThunk<void, string, { state: RootState }>(
  'app/loadProjectTree',
  async (title, { getState, dispatch }) => {
    const { vaultPath } = getState().app;
    if (!vaultPath) return;
    
    dispatch(setIsLoading(true));
    dispatch(setSelectedProject(title));
    dispatch(setProjectTree(null));
    dispatch(setPreviewContent(''));
    dispatch(addLog({ message: `Loading dependency tree for project: ${title}...`, type: 'info' }));
    try {
      const result: ProjectTree = await invoke('get_project_tree', { vaultPath, projectTitle: title });
      dispatch(setProjectTree(result));
      
      // Select all resolved dependencies by default
      const defaultSelected = result.dependencies.map(d => d.title);
      dispatch(setSelectedDeps(defaultSelected));
      dispatch(addLog({ message: `Tree parsed. Resolved ${result.dependencies.length} wiki-link references.`, type: 'success' }));
      
      // Auto trigger preview compile
      dispatch(generatePreviewThunk({ target: title, selectedDeps: defaultSelected }));
    } catch (err) {
      dispatch(addLog({ message: `Failed to load dependency tree: ${err}`, type: 'error' }));
    } finally {
      dispatch(setIsLoading(false));
    }
  }
);

// Generate study guide preview
export const generatePreviewThunk = createAsyncThunk<void, { target: string; selectedDeps: string[] }, { state: RootState }>(
  'app/generatePreview',
  async ({ target, selectedDeps }, { getState, dispatch }) => {
    const { vaultPath } = getState().app;
    try {
      const compiled: string = await invoke('preview_stage_bundle', {
        vaultPath,
        target,
        selectedDeps
      });
      dispatch(setPreviewContent(compiled));
    } catch (err) {
      dispatch(addLog({ message: `Failed to generate live preview: ${err}`, type: 'error' }));
    }
  }
);

// Toggle selective dependency inclusion
export const toggleDependencyThunk = createAsyncThunk<void, string, { state: RootState }>(
  'app/toggleDependency',
  async (depTitle, { getState, dispatch }) => {
    const { selectedDeps, selectedProject } = getState().app;
    const isAlreadySelected = selectedDeps.includes(depTitle);
    const updated = isAlreadySelected 
      ? selectedDeps.filter(t => t !== depTitle) 
      : [...selectedDeps, depTitle];
      
    dispatch(setSelectedDeps(updated));
    
    if (selectedProject) {
      dispatch(generatePreviewThunk({ target: selectedProject, selectedDeps: updated }));
    }
  }
);

// Stage the selectively compiled study guide bundle
export const stageBundleThunk = createAsyncThunk<void, void, { state: RootState }>(
  'app/stageBundle',
  async (_, { getState, dispatch }) => {
    const { vaultPath, outDir, selectedProject, selectedDeps } = getState().app;
    if (!vaultPath || !outDir || !selectedProject) {
      dispatch(addLog({ message: 'Error: Missing required path configurations.', type: 'error' }));
      return;
    }
    dispatch(setIsLoading(true));
    dispatch(addLog({ message: `Compiling and staging ${selectedProject} to output dropzone...`, type: 'info' }));
    try {
      const outPath: string = await invoke('stage_project_bundle', {
        vaultPath,
        target: selectedProject,
        outDir,
        selectedDeps
      });
      dispatch(addLog({ message: `Successfully compiled and staged bundle! Written to: ${outPath}`, type: 'success' }));
    } catch (err) {
      dispatch(addLog({ message: `Staging compile failed: ${err}`, type: 'error' }));
    } finally {
      dispatch(setIsLoading(false));
    }
  }
);

// Run vault integrity audit
export const runVaultAuditThunk = createAsyncThunk<void, void, { state: RootState }>(
  'app/runVaultAudit',
  async (_, { getState, dispatch }) => {
    const { vaultPath } = getState().app;
    if (!vaultPath) {
      dispatch(addLog({ message: 'Error: Vault path is required to run audit.', type: 'error' }));
      return;
    }
    dispatch(setIsLoading(true));
    dispatch(addLog({ message: 'Auditing vault PARA structures and checking link integrity...', type: 'info' }));
    try {
      const projectNotes: Note[] = await invoke('scan_projects', { vaultPath });
      const foundBroken: { note: string; broken: string }[] = [];

      for (const proj of projectNotes) {
        const tree: ProjectTree = await invoke('get_project_tree', { vaultPath, projectTitle: proj.title });
        for (const dep of tree.dependencies) {
          if (dep.category === 'Unknown') {
            foundBroken.push({ note: proj.title, broken: dep.title });
          }
        }
      }
      
      dispatch(setBrokenLinks(foundBroken));
      dispatch(addLog({ 
        message: `Audit complete. Found ${foundBroken.length} broken wiki-links.`, 
        type: foundBroken.length > 0 ? 'error' : 'success' 
      }));
    } catch (err) {
      dispatch(addLog({ message: `Audit failed: ${err}`, type: 'error' }));
    } finally {
      dispatch(setIsLoading(false));
    }
  }
);

// --- SLICE CONFIGURATION ---

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<'workspace' | 'integrity' | 'config'>) {
      state.activeTab = action.payload;
    },
    setVaultPath(state, action: PayloadAction<string>) {
      state.vaultPath = action.payload;
    },
    setOutDir(state, action: PayloadAction<string>) {
      state.outDir = action.payload;
    },
    setProjects(state, action: PayloadAction<Note[]>) {
      state.projects = action.payload;
    },
    setSelectedProject(state, action: PayloadAction<string>) {
      state.selectedProject = action.payload;
    },
    setProjectTree(state, action: PayloadAction<ProjectTree | null>) {
      state.projectTree = action.payload;
    },
    setSelectedDeps(state, action: PayloadAction<string[]>) {
      state.selectedDeps = action.payload;
    },
    setPreviewContent(state, action: PayloadAction<string>) {
      state.previewContent = action.payload;
    },
    setIsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setBrokenLinks(state, action: PayloadAction<{ note: string; broken: string }[]>) {
      state.brokenLinks = action.payload;
    },
    addLog(state, action: PayloadAction<{ message: string; type?: 'info' | 'success' | 'error' }>) {
      const { message, type = 'info' } = action.payload;
      const timestamp = new Date().toLocaleTimeString();
      state.consoleLogs = [
        { timestamp, message, type },
        ...state.consoleLogs
      ].slice(0, 50);
    }
  }
});

export const {
  setActiveTab,
  setVaultPath,
  setOutDir,
  setProjects,
  setSelectedProject,
  setProjectTree,
  setSelectedDeps,
  setPreviewContent,
  setIsLoading,
  setBrokenLinks,
  addLog
} = appSlice.actions;

export default appSlice.reducer;
