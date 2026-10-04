/**
 * NexusDrive Web Frontend - Directory Specification & Distributed Storage Dashboard
 */

const API_BASE = '';
const AUTH_URL = `${API_BASE}/api/auth`;
const FILES_URL = `${API_BASE}/api/files`;
const FOLDERS_URL = `${API_BASE}/api/folders`;
const SEARCH_URL = `${API_BASE}/api/search`;
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB standard NexusDrive chunk

// Global State
const state = {
  token: localStorage.getItem('nexus_access_token') || null,
  refreshToken: localStorage.getItem('nexus_refresh_token') || null,
  user: JSON.parse(localStorage.getItem('nexus_user') || 'null'),
  currentFolderId: null,
  currentFolderName: 'Root',
  folderBreadcrumbs: [{ id: null, name: 'Root' }],
  viewMode: localStorage.getItem('nexus_view_mode') || 'grid',
  files: [],
  folders: [],
  allFoldersCache: JSON.parse(localStorage.getItem('nexus_folders_cache') || '[]'),
  searchQuery: '',
  nodeStatus: { 'node-1': false, 'node-2': false, 'node-3': false },
  editingFolder: null
};

// DOM Elements
const authModal = document.getElementById('auth-modal');
const userControls = document.getElementById('user-controls');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const filesView = document.getElementById('files-view');
const filesLoading = document.getElementById('files-loading');
const filesEmpty = document.getElementById('files-empty');
const foldersContainer = document.getElementById('folders-container');
const foldersGrid = document.getElementById('folders-grid');
const breadcrumbs = document.getElementById('breadcrumbs');
const uploadTray = document.getElementById('upload-tray');
const uploadTrayList = document.getElementById('upload-tray-list');
const dragDropOverlay = document.getElementById('drag-drop-overlay');
const fileInputHidden = document.getElementById('file-input-hidden');
const toastContainer = document.getElementById('toast-container');
const treeSubfolders = document.getElementById('tree-subfolders');
const clusterDrawer = document.getElementById('cluster-drawer');

// Spec Elements
const specCurrentPath = document.getElementById('spec-current-path');
const specFolderCount = document.getElementById('spec-folder-count');
const specFileCount = document.getElementById('spec-file-count');
const specTotalSize = document.getElementById('spec-total-size');
const foldersCountBadge = document.getElementById('folders-count-badge');
const filesCountBadge = document.getElementById('files-count-badge');

// Modals
const previewModal = document.getElementById('preview-modal');
const chunksModal = document.getElementById('chunks-modal');
const folderModal = document.getElementById('folder-modal');
const deleteModal = document.getElementById('delete-modal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuth();
  startClusterHealthPolling();
});

// ============================================================================
// Authentication
// ============================================================================

function checkAuth() {
  if (state.token && state.user) {
    renderUserControls();
    hideAuthModal();
    loadDirectory();
  } else {
    showAuthModal();
  }
}

function showAuthModal() {
  authModal.classList.remove('hidden');
}

function hideAuthModal() {
  authModal.classList.add('hidden');
}

function renderUserControls() {
  if (!state.user) {
    userControls.innerHTML = `
      <button id="btn-header-login" class="btn btn-primary btn-sm">Sign In</button>
    `;
    document.getElementById('btn-header-login')?.addEventListener('click', showAuthModal);
    return;
  }

  const initial = (state.user.username || 'U')[0].toUpperCase();
  userControls.innerHTML = `
    <div class="user-badge" title="Logged in as ${escapeHtml(state.user.username)}">
      <div class="user-avatar">${initial}</div>
      <span class="user-name">${escapeHtml(state.user.username)}</span>
    </div>
    <button id="btn-logout" class="btn btn-secondary btn-sm" title="Log out">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
    </button>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', logout);
}

async function login(username, password) {
  try {
    const res = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');

    state.token = data.data.accessToken;
    state.refreshToken = data.data.refreshToken;
    state.user = { username };

    localStorage.setItem('nexus_access_token', state.token);
    localStorage.setItem('nexus_refresh_token', state.refreshToken);
    localStorage.setItem('nexus_user', JSON.stringify(state.user));

    renderUserControls();
    hideAuthModal();
    showToast(`Welcome back, ${username}!`, 'success');
    loadDirectory();
  } catch (err) {
    showAuthError('login-error', err.message);
  }
}

async function register(username, email, password) {
  try {
    const res = await fetch(`${AUTH_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');

    showToast('Account created successfully! Logging in...', 'success');
    await login(username, password);
  } catch (err) {
    showAuthError('reg-error', err.message);
  }
}

function logout() {
  state.token = null;
  state.refreshToken = null;
  state.user = null;
  localStorage.removeItem('nexus_access_token');
  localStorage.removeItem('nexus_refresh_token');
  localStorage.removeItem('nexus_user');
  renderUserControls();
  showAuthModal();
  showToast('Logged out of NexusDrive', 'info');
}

function showAuthError(elementId, msg) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}

async function performQuickDemoLogin() {
  const demoUser = 'demo_user';
  const demoPass = 'Password123!';
  const demoEmail = 'demo@nexusdrive.local';

  try {
    const res = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: demoUser, password: demoPass })
    });
    if (res.ok) {
      const data = await res.json();
      state.token = data.data.accessToken;
      state.refreshToken = data.data.refreshToken;
      state.user = { username: demoUser };
      localStorage.setItem('nexus_access_token', state.token);
      localStorage.setItem('nexus_refresh_token', state.refreshToken);
      localStorage.setItem('nexus_user', JSON.stringify(state.user));
      renderUserControls();
      hideAuthModal();
      showToast('Logged in with Demo Account', 'success');
      loadDirectory();
      return;
    }
    await register(demoUser, demoEmail, demoPass);
  } catch (err) {
    showToast('Demo login error: ' + err.message, 'error');
  }
}

// ============================================================================
// Cluster Node Monitoring
// ============================================================================

async function checkClusterHealth() {
  const nodes = ['node-1', 'node-2', 'node-3'];
  const ports = { 'node-1': 9001, 'node-2': 9002, 'node-3': 9003 };

  let healthyCount = 0;
  for (const node of nodes) {
    try {
      const res = await fetch(`/nodes/${node}/actuator/health`, { signal: AbortSignal.timeout(2500) });
      const data = await res.json();
      const isUp = res.ok && data.status === 'UP';
      state.nodeStatus[node] = isUp;
      if (isUp) healthyCount++;

      const badge = document.getElementById(`${node.replace('-', '')}-badge`);
      if (badge) {
        badge.classList.toggle('down', !isUp);
        badge.title = `${node.toUpperCase()} (${ports[node]}): ${isUp ? 'HEALTHY' : 'OFFLINE'}`;
      }

      const dnPill = document.getElementById(`dn-${node.replace('-', '')}-status`);
      if (dnPill) {
        dnPill.textContent = isUp ? 'UP' : 'DOWN';
        dnPill.className = `status-pill ${isUp ? 'status-up' : 'text-danger'}`;
      }
    } catch {
      state.nodeStatus[node] = false;
      const badge = document.getElementById(`${node.replace('-', '')}-badge`);
      if (badge) badge.classList.add('down');
      const dnPill = document.getElementById(`dn-${node.replace('-', '')}-status`);
      if (dnPill) {
        dnPill.textContent = 'DOWN';
        dnPill.className = 'status-pill text-danger';
      }
    }
  }

  const indicator = document.getElementById('cluster-indicator');
  if (indicator) {
    indicator.className = `status-indicator ${healthyCount === 3 ? 'live' : 'text-warning'}`;
  }
}

function startClusterHealthPolling() {
  checkClusterHealth();
  setInterval(checkClusterHealth, 10000);
}

// ============================================================================
// Directory Specification & Hierarchy Operations
// ============================================================================

function saveFoldersCache(folders) {
  state.allFoldersCache = folders;
  localStorage.setItem('nexus_folders_cache', JSON.stringify(folders));
  renderDirectoryTree();
}

function renderDirectoryTree() {
  if (!treeSubfolders) return;
  treeSubfolders.innerHTML = '';

  const rootActive = state.currentFolderId === null;
  const treeRoot = document.getElementById('tree-root');
  if (treeRoot) treeRoot.classList.toggle('active', rootActive);

  state.allFoldersCache.forEach(folder => {
    const item = document.createElement('div');
    const isActive = state.currentFolderId === folder.id;
    item.className = `tree-item ${isActive ? 'active' : ''}`;
    item.dataset.folderId = folder.id;
    item.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="tree-label">${escapeHtml(folder.name)}</span>
    `;
    item.addEventListener('click', () => navigateToFolder(folder.id, folder.name));
    treeSubfolders.appendChild(item);
  });
}

function updateDirectorySpec(folders, files) {
  const currentPathStr = state.folderBreadcrumbs.map(b => b.name).join(' / ');
  specCurrentPath.textContent = currentPathStr.replace('Root', '/');
  specCurrentPath.title = currentPathStr;

  const totalFolderCount = folders.length;
  const totalFileCount = files.length;
  const totalBytes = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

  specFolderCount.textContent = totalFolderCount;
  specFileCount.textContent = totalFileCount;
  specTotalSize.textContent = formatBytes(totalBytes);

  foldersCountBadge.textContent = `${totalFolderCount} folder${totalFolderCount === 1 ? '' : 's'}`;
  filesCountBadge.textContent = `${totalFileCount} file${totalFileCount === 1 ? '' : 's'}`;

  // Toggle Rename/Delete buttons for current folder
  const btnRename = document.getElementById('btn-rename-current-folder');
  const btnDelete = document.getElementById('btn-delete-current-folder');
  if (btnRename && btnDelete) {
    const isRoot = state.currentFolderId === null;
    btnRename.classList.toggle('hidden', isRoot);
    btnDelete.classList.toggle('hidden', isRoot);
  }

  // Update storage pool
  document.getElementById('storage-file-count').textContent = `${totalFileCount} in dir`;
  document.getElementById('storage-used-text').textContent = `${formatBytes(totalBytes)} stored`;
}

function renderBreadcrumbs() {
  breadcrumbs.innerHTML = '';
  state.folderBreadcrumbs.forEach((crumb, idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '/';
      breadcrumbs.appendChild(sep);
    }

    const span = document.createElement('span');
    const isLast = idx === state.folderBreadcrumbs.length - 1;
    span.className = `crumb ${isLast ? 'active' : ''}`;
    span.textContent = crumb.name === 'Root' ? '/ (Root)' : crumb.name;
    span.dataset.folder = crumb.id || '';

    if (!isLast) {
      span.addEventListener('click', () => {
        state.folderBreadcrumbs = state.folderBreadcrumbs.slice(0, idx + 1);
        navigateToFolder(crumb.id, crumb.name, false);
      });
    }

    breadcrumbs.appendChild(span);
  });
}

async function navigateToFolder(folderId, folderName, appendCrumb = true) {
  state.currentFolderId = folderId;
  state.currentFolderName = folderName;

  if (appendCrumb) {
    if (folderId === null) {
      state.folderBreadcrumbs = [{ id: null, name: 'Root' }];
    } else {
      const exists = state.folderBreadcrumbs.findIndex(b => b.id === folderId);
      if (exists !== -1) {
        state.folderBreadcrumbs = state.folderBreadcrumbs.slice(0, exists + 1);
      } else {
        state.folderBreadcrumbs.push({ id: folderId, name: folderName });
      }
    }
  }

  renderBreadcrumbs();
  renderDirectoryTree();
  await loadDirectory();
}

async function loadDirectory() {
  if (!state.token) return;

  filesLoading.classList.remove('hidden');
  filesEmpty.classList.add('hidden');
  filesView.innerHTML = '';
  foldersGrid.innerHTML = '';

  try {
    if (state.searchQuery) {
      // Global Search across directory specs
      foldersContainer.classList.add('hidden');
      document.getElementById('files-section-heading').textContent = `Search: "${state.searchQuery}"`;

      const res = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(state.searchQuery)}&page=0&size=100`, {
        headers: { Authorization: `Bearer ${state.token}` }
      });
      const json = await res.json();
      state.files = json.data?.content || [];
      state.folders = [];
    } else if (state.currentFolderId !== null) {
      // Query specific folder contents via /api/folders/{id}/contents
      foldersContainer.classList.remove('hidden');
      document.getElementById('files-section-heading').textContent = `Files in ${state.currentFolderName}`;

      const res = await fetch(`${FOLDERS_URL}/${state.currentFolderId}/contents`, {
        headers: { Authorization: `Bearer ${state.token}` }
      });

      if (!res.ok) throw new Error('Failed to load folder contents');
      const json = await res.json();
      state.folders = json.data?.folders || [];
      state.files = json.data?.files || [];
    } else {
      // Root Directory: fetch all files and cached root folders
      foldersContainer.classList.remove('hidden');
      document.getElementById('files-section-heading').textContent = 'Root Directory Files';

      const res = await fetch(`${SEARCH_URL}?page=0&size=100`, {
        headers: { Authorization: `Bearer ${state.token}` }
      });
      const json = await res.json();
      state.files = json.data?.content || [];
      state.folders = state.allFoldersCache;
    }

    updateDirectorySpec(state.folders, state.files);
    renderFolders(state.folders);

    if (state.files.length === 0 && state.folders.length === 0) {
      filesEmpty.classList.remove('hidden');
    } else {
      renderFiles(state.files);
    }
  } catch (err) {
    showToast('Failed to load directory: ' + err.message, 'error');
  } finally {
    filesLoading.classList.add('hidden');
  }
}

function renderFolders(folders) {
  foldersGrid.innerHTML = '';
  if (!folders || folders.length === 0) {
    foldersGrid.innerHTML = '<span class="text-dim text-sm" style="grid-column: 1/-1;">No subdirectories in this path.</span>';
    return;
  }

  folders.forEach(folder => {
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.dataset.id = folder.id;

    card.innerHTML = `
      <div class="folder-card-main">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <div class="folder-card-info">
          <span class="folder-card-name" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</span>
          <span class="folder-card-path">${escapeHtml(folder.fullPath || '/' + folder.name)}</span>
        </div>
      </div>
      <div class="folder-card-actions">
        <button class="btn-icon btn-sm btn-folder-rename" title="Rename Directory">✏️</button>
        <button class="btn-icon btn-sm btn-folder-delete" title="Delete Directory">🗑️</button>
      </div>
    `;

    card.querySelector('.folder-card-main').addEventListener('click', () => {
      navigateToFolder(folder.id, folder.name);
    });

    card.querySelector('.btn-folder-rename').addEventListener('click', (e) => {
      e.stopPropagation();
      openRenameFolderModal(folder);
    });

    card.querySelector('.btn-folder-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteFolderModal(folder);
    });

    foldersGrid.appendChild(card);
  });
}

// ============================================================================
// Files Rendering
// ============================================================================

function renderFiles(files) {
  filesView.innerHTML = '';
  filesView.className = state.viewMode === 'grid' ? 'files-grid' : 'files-list';

  if (state.viewMode === 'list') {
    renderFilesList(files);
  } else {
    renderFilesGrid(files);
  }
}

function renderFilesGrid(files) {
  files.forEach(file => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.dataset.id = file.id;

    const fileIcon = getFileIcon(file.mimeType, file.filename);
    const formattedSize = formatBytes(file.sizeBytes);
    const dateStr = formatDate(file.createdAt);
    const chunkCount = file.expectedChunks || 1;

    card.innerHTML = `
      <div class="file-card-preview" title="Click to preview">
        ${fileIcon}
      </div>
      <div class="file-card-meta">
        <span class="file-card-name" title="${escapeHtml(file.filename)}">${escapeHtml(file.filename)}</span>
        <div class="file-card-sub">
          <span>${formattedSize}</span>
          <span class="file-chunks-tag" title="Stored in ${chunkCount} encrypted chunk(s)">${chunkCount} chunk${chunkCount > 1 ? 's' : ''}</span>
        </div>
        <div class="file-card-sub text-dim">
          <span>${dateStr}</span>
        </div>
      </div>
      <div class="file-card-actions">
        <button class="btn-icon btn-preview" title="Preview file">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
        <button class="btn-icon btn-download" title="Download decrypted file">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button class="btn-icon btn-chunks" title="Inspect chunk sharding and replica distribution">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </button>
        <button class="btn-icon btn-delete" title="Delete file">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    card.querySelector('.file-card-preview').addEventListener('click', () => openPreviewModal(file));
    card.querySelector('.file-card-name').addEventListener('click', () => openPreviewModal(file));
    card.querySelector('.btn-preview').addEventListener('click', () => openPreviewModal(file));
    card.querySelector('.btn-download').addEventListener('click', () => downloadFile(file));
    card.querySelector('.btn-chunks').addEventListener('click', () => openChunksModal(file));
    card.querySelector('.btn-delete').addEventListener('click', () => openDeleteModal(file));

    filesView.appendChild(card);
  });
}

function renderFilesList(files) {
  const table = document.createElement('table');
  table.className = 'files-list-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Size</th>
        <th>Chunks</th>
        <th>Uploaded</th>
        <th style="text-align: right;">Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  files.forEach(file => {
    const tr = document.createElement('tr');
    const chunkCount = file.expectedChunks || 1;
    tr.innerHTML = `
      <td>
        <span style="cursor: pointer; font-weight: 600;" class="list-filename">${escapeHtml(file.filename)}</span>
      </td>
      <td>${formatBytes(file.sizeBytes)}</td>
      <td><span class="file-chunks-tag">${chunkCount}x 8MiB</span></td>
      <td class="text-dim">${formatDate(file.createdAt)}</td>
      <td style="text-align: right;">
        <button class="btn-icon btn-sm btn-preview" title="Preview">👁️</button>
        <button class="btn-icon btn-sm btn-download" title="Download">⬇️</button>
        <button class="btn-icon btn-sm btn-chunks" title="Chunks">🧩</button>
        <button class="btn-icon btn-sm btn-delete" title="Delete">🗑️</button>
      </td>
    `;

    tr.querySelector('.list-filename').addEventListener('click', () => openPreviewModal(file));
    tr.querySelector('.btn-preview').addEventListener('click', () => openPreviewModal(file));
    tr.querySelector('.btn-download').addEventListener('click', () => downloadFile(file));
    tr.querySelector('.btn-chunks').addEventListener('click', () => openChunksModal(file));
    tr.querySelector('.btn-delete').addEventListener('click', () => openDeleteModal(file));

    tbody.appendChild(tr);
  });

  filesView.appendChild(table);
}

// ============================================================================
// Upload Engine (Supports Directory Placement & Chunking)
// ============================================================================

async function handleFileUpload(files) {
  if (!files || files.length === 0) return;
  if (!state.token) {
    showAuthModal();
    return;
  }

  for (const file of Array.from(files)) {
    await uploadSingleFile(file);
  }

  loadDirectory();
}

async function uploadSingleFile(file) {
  const uploadId = 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  showUploadTray();
  addUploadTrayItem(uploadId, file.name, file.size);

  const targetDirName = state.currentFolderName || 'Root';

  try {
    if (file.size <= CHUNK_SIZE) {
      updateUploadProgress(uploadId, 30, `Streaming to ${targetDirName}...`);
      const formData = new FormData();
      formData.append('file', file);
      if (state.currentFolderId) {
        formData.append('folderId', state.currentFolderId);
      }

      const res = await fetch(`${FILES_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.token}` },
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Upload failed with status ${res.status}`);
      }

      updateUploadProgress(uploadId, 100, `Encrypted and saved to ${targetDirName}`);
      showToast(`Uploaded "${file.name}" to ${targetDirName}`, 'success');
      setTimeout(() => removeUploadTrayItem(uploadId), 3000);
      return;
    }

    // Large files: 8 MiB chunking
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    updateUploadProgress(uploadId, 10, `Sharding into ${totalChunks} chunks in ${targetDirName}...`);

    const initRes = await fetch(`${FILES_URL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        folderId: state.currentFolderId,
        tags: ['directory-spec', targetDirName]
      })
    });

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new Error(err.message || 'Initialization failed');
    }

    const initData = await initRes.json();
    const fileId = initData.data.id;

    for (let index = 0; index < totalChunks; index++) {
      const start = index * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunkBlob = file.slice(start, end);
      const chunkBuffer = await chunkBlob.arrayBuffer();

      const pct = Math.round(((index + 0.5) / totalChunks) * 90);
      updateUploadProgress(uploadId, pct, `Replicating chunk ${index + 1}/${totalChunks}...`);

      const chunkRes = await fetch(`${FILES_URL}/${fileId}/chunks/${index}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          Authorization: `Bearer ${state.token}`
        },
        body: chunkBuffer
      });

      if (!chunkRes.ok) throw new Error(`Failed to upload chunk ${index}`);
    }

    updateUploadProgress(uploadId, 100, `Complete: ${totalChunks} chunks replicated!`);
    showToast(`Chunked upload for "${file.name}" completed!`, 'success');
    setTimeout(() => removeUploadTrayItem(uploadId), 4000);
  } catch (err) {
    updateUploadProgress(uploadId, 100, `Error: ${err.message}`, true);
    showToast(`Failed to upload "${file.name}": ${err.message}`, 'error');
  }
}

function showUploadTray() {
  uploadTray.classList.remove('hidden');
}

function addUploadTrayItem(id, filename, size) {
  const item = document.createElement('div');
  item.className = 'upload-progress-item';
  item.id = id;
  item.innerHTML = `
    <div class="upload-item-info">
      <strong>${escapeHtml(filename)}</strong>
      <span class="upload-status-text" id="${id}_status">Preparing...</span>
    </div>
    <div class="upload-bar-track">
      <div class="upload-bar-fill" id="${id}_bar" style="width: 5%;"></div>
    </div>
  `;
  uploadTrayList.prepend(item);
  return item;
}

function updateUploadProgress(id, pct, statusText, isError = false) {
  const bar = document.getElementById(`${id}_bar`);
  const status = document.getElementById(`${id}_status`);
  if (bar) {
    bar.style.width = `${pct}%`;
    if (isError) bar.style.background = 'var(--color-danger)';
  }
  if (status) {
    status.textContent = statusText;
    if (isError) status.style.color = 'var(--color-danger)';
  }
}

function removeUploadTrayItem(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  if (uploadTrayList.children.length === 0) {
    uploadTray.classList.add('hidden');
  }
}

// ============================================================================
// Download & Preview
// ============================================================================

async function downloadFile(file) {
  try {
    showToast(`Decrypting and streaming "${file.filename}"...`, 'info');
    const res = await fetch(`${FILES_URL}/${file.id}/download`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Download failed: ' + res.statusText);

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    showToast(`Downloaded "${file.filename}"`, 'success');
  } catch (err) {
    showToast('Download error: ' + err.message, 'error');
  }
}

async function openPreviewModal(file) {
  document.getElementById('preview-filename').textContent = file.filename;
  document.getElementById('preview-file-size').textContent = `${formatBytes(file.sizeBytes)} • ${file.mimeType}`;
  document.getElementById('preview-file-icon').innerHTML = getFileIcon(file.mimeType, file.filename);

  const previewBody = document.getElementById('preview-body');
  previewBody.innerHTML = '<div class="spinner"></div>';
  previewModal.classList.remove('hidden');

  const btnDownload = document.getElementById('btn-preview-download');
  btnDownload.onclick = () => downloadFile(file);

  try {
    const res = await fetch(`${FILES_URL}/${file.id}/download`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Failed to retrieve file content');

    const blob = await res.blob();
    const mime = file.mimeType.toLowerCase();

    if (mime.startsWith('image/')) {
      const url = URL.createObjectURL(blob);
      previewBody.innerHTML = `<img src="${url}" alt="${escapeHtml(file.filename)}" />`;
    } else if (mime.startsWith('text/') || mime.includes('json') || mime.includes('javascript') || mime.includes('xml')) {
      const text = await blob.text();
      previewBody.innerHTML = `<pre><code>${escapeHtml(text)}</code></pre>`;
    } else if (mime === 'application/pdf') {
      const url = URL.createObjectURL(blob);
      previewBody.innerHTML = `<iframe src="${url}"></iframe>`;
    } else if (mime.startsWith('audio/')) {
      const url = URL.createObjectURL(blob);
      previewBody.innerHTML = `<audio controls src="${url}" style="width: 100%;"></audio>`;
    } else if (mime.startsWith('video/')) {
      const url = URL.createObjectURL(blob);
      previewBody.innerHTML = `<video controls src="${url}" style="max-width: 100%; max-height: 100%;"></video>`;
    } else {
      previewBody.innerHTML = `
        <div class="state-container">
          <div class="empty-icon" style="font-size: 3rem;">📦</div>
          <h3>Binary Document</h3>
          <p>This file format (${file.mimeType}) cannot be directly previewed. You can download and decrypt the full file to view locally.</p>
          <button class="btn btn-primary" onclick="downloadFile({id:'${file.id}', filename:'${escapeHtml(file.filename)}'})">Download Now</button>
        </div>
      `;
    }
  } catch (err) {
    previewBody.innerHTML = `
      <div class="state-container text-danger">
        <p>Error loading preview: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

// ============================================================================
// Chunk & Replication Inspector
// ============================================================================

async function openChunksModal(file) {
  document.getElementById('chunks-modal-filename').textContent = `${file.filename} (${formatBytes(file.sizeBytes)})`;
  chunksModal.classList.remove('hidden');

  const gridList = document.getElementById('chunks-grid-list');
  gridList.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetch(`${FILES_URL}/${file.id}/chunks/status`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    const expected = file.expectedChunks || 1;
    let uploaded = [];

    if (res.ok) {
      const data = await res.json();
      uploaded = data.data?.uploadedChunks || [];
    } else {
      for (let i = 0; i < expected; i++) uploaded.push(i);
    }

    document.getElementById('stat-expected-chunks').textContent = expected;
    document.getElementById('stat-uploaded-chunks').textContent = uploaded.length;
    document.getElementById('stat-rep-factor').textContent = '3x Replicas';

    gridList.innerHTML = '';

    for (let i = 0; i < expected; i++) {
      const isOnline = uploaded.includes(i);
      const primaryNode = `node-${(i % 3) + 1}`;
      const replicaNodes = [`node-${((i + 1) % 3) + 1}`, `node-${((i + 2) % 3) + 1}`];

      const row = document.createElement('div');
      row.className = 'chunk-row';
      row.innerHTML = `
        <div class="chunk-row-left">
          <span class="chunk-badge">#${i}</span>
          <div>
            <strong>Chunk ${file.id.substr(0, 8)}-${i}.chunk</strong>
            <div class="text-dim text-sm">8 MiB AES-256-GCM block</div>
          </div>
        </div>
        <div class="chunk-nodes">
          <span class="replica-node-pill" title="Primary Placement Node">Primary: ${primaryNode}</span>
          <span class="replica-node-pill" title="Secondary Replica">Replica 1: ${replicaNodes[0]}</span>
          <span class="replica-node-pill" title="Tertiary Replica">Replica 2: ${replicaNodes[1]}</span>
          <span class="status-pill ${isOnline ? 'status-up' : 'text-danger'}">${isOnline ? 'ONLINE' : 'MISSING'}</span>
        </div>
      `;
      gridList.appendChild(row);
    }
  } catch (err) {
    gridList.innerHTML = `<p class="text-danger">Failed to fetch chunk status: ${err.message}</p>`;
  }
}

// ============================================================================
// Folder Management Modals (Create / Rename / Delete)
// ============================================================================

function openCreateFolderModal() {
  state.editingFolder = null;
  document.getElementById('folder-modal-title').textContent = `New Subdirectory in ${state.currentFolderName}`;
  document.getElementById('folder-name-input').value = '';
  document.getElementById('btn-folder-submit').textContent = 'Create Directory';
  folderModal.classList.remove('hidden');
}

function openRenameFolderModal(folder) {
  state.editingFolder = folder;
  document.getElementById('folder-modal-title').textContent = `Rename Directory "${folder.name}"`;
  document.getElementById('folder-name-input').value = folder.name;
  document.getElementById('btn-folder-submit').textContent = 'Rename';
  folderModal.classList.remove('hidden');
}

function openDeleteFolderModal(folder) {
  itemToDelete = { ...folder, isFolder: true };
  document.getElementById('delete-modal-title').textContent = 'Confirm Directory Deletion';
  document.getElementById('delete-item-name').textContent = `Directory "${folder.name}"`;
  deleteModal.classList.remove('hidden');
}

// ============================================================================
// Delete Operations
// ============================================================================

let itemToDelete = null;

function openDeleteModal(file) {
  itemToDelete = { ...file, isFolder: false };
  document.getElementById('delete-modal-title').textContent = 'Confirm File Deletion';
  document.getElementById('delete-item-name').textContent = `File "${file.filename}"`;
  deleteModal.classList.remove('hidden');
}

async function confirmDelete() {
  if (!itemToDelete) return;
  deleteModal.classList.add('hidden');

  try {
    if (itemToDelete.isFolder) {
      const res = await fetch(`${FOLDERS_URL}/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${state.token}` }
      });
      if (!res.ok) throw new Error('Directory deletion failed');

      // Update cached folders
      const updated = state.allFoldersCache.filter(f => f.id !== itemToDelete.id);
      saveFoldersCache(updated);

      showToast(`Deleted directory "${itemToDelete.name}"`, 'info');
      if (state.currentFolderId === itemToDelete.id) {
        navigateToFolder(null, 'Root');
      } else {
        loadDirectory();
      }
    } else {
      const res = await fetch(`${FILES_URL}/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${state.token}` }
      });
      if (!res.ok) throw new Error('File deletion failed');

      showToast(`Deleted file "${itemToDelete.filename}"`, 'info');
      loadDirectory();
    }
  } catch (err) {
    showToast('Delete error: ' + err.message, 'error');
  } finally {
    itemToDelete = null;
  }
}

// ============================================================================
// Event Listeners & Interactions
// ============================================================================

function setupEventListeners() {
  // Tree Root click
  document.getElementById('tree-root')?.addEventListener('click', () => {
    navigateToFolder(null, 'Root');
  });

  // Cluster Drawer toggle
  document.getElementById('btn-toggle-cluster-drawer')?.addEventListener('click', () => {
    clusterDrawer.classList.remove('hidden');
  });

  document.getElementById('btn-close-cluster-drawer')?.addEventListener('click', () => {
    clusterDrawer.classList.add('hidden');
  });

  // Auth Tabs
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden');
    formLogin.classList.remove('hidden');
  });

  formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    if (u && p) login(u, p);
  });

  formRegister.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('reg-username').value.trim();
    const em = document.getElementById('reg-email').value.trim();
    const p = document.getElementById('reg-password').value;
    if (u && em && p) register(u, em, p);
  });

  document.getElementById('btn-quick-demo').addEventListener('click', performQuickDemoLogin);

  // File Upload
  const btnUpload = document.getElementById('btn-open-upload');
  btnUpload.addEventListener('click', () => fileInputHidden.click());
  document.getElementById('btn-empty-upload')?.addEventListener('click', () => fileInputHidden.click());

  fileInputHidden.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
      fileInputHidden.value = '';
    }
  });

  // Drag and Drop
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.types?.includes('Files')) {
      document.getElementById('drop-target-folder-text').textContent =
        `Uploading directly into "${state.currentFolderName}" (${state.currentFolderId ? 'Subdirectory' : 'Root'})`;
      dragDropOverlay.classList.remove('hidden');
    }
  });

  dragDropOverlay.addEventListener('dragover', (e) => e.preventDefault());

  dragDropOverlay.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null || e.relatedTarget === document.documentElement) {
      dragDropOverlay.classList.add('hidden');
    }
  });

  dragDropOverlay.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDropOverlay.classList.add('hidden');
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  });

  // Search input
  let searchTimeout = null;
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    clearSearchBtn.classList.toggle('hidden', val.length === 0);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = val;
      loadDirectory();
    }, 300);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    state.searchQuery = '';
    loadDirectory();
  });

  // Refresh
  document.getElementById('btn-refresh').addEventListener('click', () => {
    showToast('Refreshing directory spec...', 'info');
    loadDirectory();
    checkClusterHealth();
  });

  // View toggle
  document.getElementById('btn-view-grid').addEventListener('click', () => {
    state.viewMode = 'grid';
    localStorage.setItem('nexus_view_mode', 'grid');
    document.getElementById('btn-view-grid').classList.add('active');
    document.getElementById('btn-view-list').classList.remove('active');
    renderFiles(state.files);
  });

  document.getElementById('btn-view-list').addEventListener('click', () => {
    state.viewMode = 'list';
    localStorage.setItem('nexus_view_mode', 'list');
    document.getElementById('btn-view-list').classList.add('active');
    document.getElementById('btn-view-grid').classList.remove('active');
    renderFiles(state.files);
  });

  // Close modals
  document.getElementById('btn-close-preview').addEventListener('click', () => previewModal.classList.add('hidden'));
  document.getElementById('btn-close-chunks').addEventListener('click', () => chunksModal.classList.add('hidden'));
  document.getElementById('btn-close-delete-modal').addEventListener('click', () => deleteModal.classList.add('hidden'));
  document.getElementById('btn-cancel-delete').addEventListener('click', () => deleteModal.classList.add('hidden'));
  document.getElementById('btn-confirm-delete').addEventListener('click', confirmDelete);

  [previewModal, chunksModal, deleteModal, folderModal, clusterDrawer].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });

  // Folder buttons
  document.getElementById('btn-new-folder').addEventListener('click', openCreateFolderModal);
  document.getElementById('btn-sidebar-new-folder')?.addEventListener('click', openCreateFolderModal);
  document.getElementById('btn-empty-new-folder')?.addEventListener('click', openCreateFolderModal);

  document.getElementById('btn-rename-current-folder')?.addEventListener('click', () => {
    if (state.currentFolderId) {
      openRenameFolderModal({ id: state.currentFolderId, name: state.currentFolderName });
    }
  });

  document.getElementById('btn-delete-current-folder')?.addEventListener('click', () => {
    if (state.currentFolderId) {
      openDeleteFolderModal({ id: state.currentFolderId, name: state.currentFolderName });
    }
  });

  document.getElementById('btn-close-folder-modal').addEventListener('click', () => folderModal.classList.add('hidden'));
  document.getElementById('btn-cancel-folder').addEventListener('click', () => folderModal.classList.add('hidden'));

  // Form submit for folder (Create OR Rename)
  document.getElementById('form-create-folder').addEventListener('submit', async (e) => {
    e.preventDefault();
    const folderName = document.getElementById('folder-name-input').value.trim();
    if (!folderName) return;

    folderModal.classList.add('hidden');
    try {
      if (state.editingFolder) {
        // Rename folder
        const res = await fetch(`${FOLDERS_URL}/${state.editingFolder.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`
          },
          body: JSON.stringify({ name: folderName, parentId: state.currentFolderId })
        });
        if (!res.ok) throw new Error('Folder rename failed');
        const json = await res.json();
        const updatedFolder = json.data;

        const updatedCache = state.allFoldersCache.map(f => f.id === updatedFolder.id ? updatedFolder : f);
        saveFoldersCache(updatedCache);

        if (state.currentFolderId === updatedFolder.id) {
          state.currentFolderName = updatedFolder.name;
          state.folderBreadcrumbs[state.folderBreadcrumbs.length - 1].name = updatedFolder.name;
          renderBreadcrumbs();
        }

        showToast(`Renamed directory to "${folderName}"`, 'success');
      } else {
        // Create folder
        const res = await fetch(FOLDERS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`
          },
          body: JSON.stringify({ name: folderName, parentId: state.currentFolderId })
        });
        if (!res.ok) throw new Error('Folder creation failed');
        const json = await res.json();
        const newFolder = json.data;

        const updatedCache = [...state.allFoldersCache, newFolder];
        saveFoldersCache(updatedCache);

        showToast(`Created directory "${folderName}"`, 'success');
      }

      document.getElementById('folder-name-input').value = '';
      loadDirectory();
    } catch (err) {
      showToast('Directory error: ' + err.message, 'error');
    }
  });

  // Minimize upload tray
  document.getElementById('btn-minimize-tray').addEventListener('click', () => {
    uploadTray.classList.add('hidden');
  });

  // Initial tree render
  renderDirectoryTree();
}

// ============================================================================
// Toast Notifications
// ============================================================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `
    <span style="font-weight: bold;">${icon}</span>
    <span>${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes) {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

function getFileIcon(mime, filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const m = (mime || '').toLowerCase();

  if (m.startsWith('image/')) {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>`;
  }
  if (m === 'application/pdf' || ext === 'pdf') {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>`;
  }
  if (m.startsWith('text/') || ['js', 'ts', 'java', 'py', 'json', 'md', 'html', 'css'].includes(ext)) {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.8">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </svg>`;
  }
  if (m.startsWith('audio/')) {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="1.8">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>`;
  }
  if (m.startsWith('video/')) {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.8">
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </svg>`;
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.8">
      <polyline points="21 8 21 21 3 21 3 8"></polyline>
      <rect x="1" y="3" width="22" height="5"></rect>
      <line x1="10" y1="12" x2="14" y2="12"></line>
    </svg>`;
  }

  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.8">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
    <polyline points="13 2 13 9 20 9"></polyline>
  </svg>`;
}
