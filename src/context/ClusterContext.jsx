import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchInventory, fetchVm } from '../utils/api';

const ClusterContext = createContext(null);

export function ClusterProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('rhov_theme') || 'dark');
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected navigation entity: { type: 'datacenter' | 'cluster' | 'node' | 'vm', id: string }
  const [selectedEntity, setSelectedEntity] = useState({ type: 'datacenter', id: 'dc-01' });
  const [selectedVmDetail, setSelectedVmDetail] = useState(null);
  const [activeVmTab, setActiveVmTab] = useState('summary');

  // Multi-Namespace (Project) Global State
  const [namespaces, setNamespaces] = useState([]);
  const [selectedNamespace, setSelectedNamespace] = useState(() => {
    return localStorage.getItem('rhov_selected_ns') || 'all';
  });
  const [showSystemProjects, setShowSystemProjects] = useState(false);

  const handleSetSelectedNamespace = useCallback((ns) => {
    setSelectedNamespace(ns);
    localStorage.setItem('rhov_selected_ns', ns);
  }, []);

  const toggleShowSystemProjects = useCallback(() => {
    setShowSystemProjects(prev => !prev);
  }, []);

  // Modals state
  const [modals, setModals] = useState({
    editSpecs: false,
    createVm: false,
    migrate: false,
    snapshot: false,
    connect: false,
    clone: false,
    createNamespace: false,
    deleteVm: false
  });
  const [modalTargetVm, setModalTargetVm] = useState(null);

  // Power Action Modal (ACPI Safe Shutdown vs Force Power Off)
  const [powerModal, setPowerModal] = useState({
    isOpen: false,
    mode: 'shutdown', // 'shutdown' | 'force' | 'restart' | 'start'
    targetVm: null
  });

  const openPowerModal = useCallback((targetVm, mode = 'shutdown') => {
    setPowerModal({
      isOpen: true,
      mode,
      targetVm: targetVm || selectedVmDetail
    });
  }, [selectedVmDetail]);

  const closePowerModal = useCallback(() => {
    setPowerModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Context Menu State { isOpen: boolean, x: number, y: number, entityType: string, entityData: any }
  const [contextMenu, setContextMenu] = useState(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Search & Status Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Running' | 'Stopped' | 'Error'

  // Operator View Mode ('gui' | 'yaml')
  const [viewMode, setViewMode] = useState('gui');

  // Pinned VMs & Recent Visits (#7, #8)
  // Pinned VMs & Recent Visits (#7, #8)
  const [pinnedVmIds, setPinnedVmIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rhov_pinned_vms') || '[]');
    } catch {
      return [];
    }
  });

  const togglePinVm = useCallback((id) => {
    setPinnedVmIds(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('rhov_pinned_vms', JSON.stringify(next));
      return next;
    });
  }, []);

  const [recentVmIds, setRecentVmIds] = useState([]);

  // Bottom Recent Tasks Queue (starts clean, populated only by real user actions)
  const [isTasksOpen, setIsTasksOpen] = useState(true);
  const [tasks, setTasks] = useState([]);

  const addTask = useCallback((taskName, targetName, initiator = 'kubeadmin') => {
    const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const newTask = {
      id: taskId,
      name: taskName,
      target: targetName,
      initiator,
      progress: 15,
      status: 'In-Progress',
      startTime: timeStr,
      error: null
    };
    setTasks(prev => [newTask, ...prev.slice(0, 24)]);
    return taskId;
  }, []);

  const updateTask = useCallback((taskId, updates) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...updates } : t)));
  }, []);

  // Toast notifications
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'info', duration = 3000) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), duration);
  }, []);

  // Theme synchronization
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rhov_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Fetch full inventory tree
  const loadInventory = useCallback(async (keepSelection = true) => {
    try {
      setLoading(true);
      const data = await fetchInventory();
      setInventory(data);
      if (data.namespaces) {
        setNamespaces(data.namespaces);
      }

      // If a VM was selected, refresh its details
      if (keepSelection && selectedEntity.type === 'vm' && selectedEntity.id) {
        try {
          const vmData = await fetchVm(selectedEntity.id);
          setSelectedVmDetail(vmData);
        } catch (e) {
          console.warn('Selected VM not found, likely deleted in OpenShift:', selectedEntity.id);
          setSelectedVmDetail(null);
          if (data.vms && data.vms.length > 0) {
            setSelectedEntity({ type: 'vm', id: data.vms[0].id || data.vms[0].name });
            setSelectedVmDetail(data.vms[0]);
          } else {
            setSelectedEntity({ type: 'cluster', id: 'cluster-01' });
          }
        }
      } else if (!keepSelection || !selectedEntity.id) {
        // Default to first VM if available
        if (data.vms && data.vms.length > 0) {
          const firstVm = data.vms[0];
          setSelectedEntity({ type: 'vm', id: firstVm.id || firstVm.name });
          setSelectedVmDetail(firstVm);
        }
      }
      setError(null);
    } catch (err) {
      console.error('Error loading inventory:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedEntity]);

  // Real-Time Event-Driven Sync via WebSocket (/ws/live-sync)
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    function connectLiveSync() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live-sync`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[LiveSync WS] Connected to portal real-time cluster event stream.');
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'INITIAL_STATE' && msg.payload) {
              setInventory(msg.payload);
              if (msg.payload.namespaces) {
                setNamespaces(msg.payload.namespaces);
              }
              setLoading(false);
              setSelectedEntity(prev => {
                if (prev.type === 'vm') {
                  const currentVm = msg.payload.vms?.find(v => v.id === prev.id || v.name === prev.id);
                  if (currentVm) {
                    setSelectedVmDetail(currentVm);
                    return prev;
                  } else if (msg.payload.vms?.length > 0) {
                    setSelectedVmDetail(msg.payload.vms[0]);
                    return { type: 'vm', id: msg.payload.vms[0].id || msg.payload.vms[0].name };
                  }
                }
                return prev;
              });
            } else if (msg.type === 'VM_DELETED') {
              const deletedName = msg.payload?.name || msg.payload?.id;
              console.log(`[LiveSync] 🔥 VM '${deletedName}' DELETED on OpenShift. Evicting immediately.`);
              setInventory(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  vms: (prev.vms || []).filter(v => v.name !== deletedName && v.id !== deletedName),
                  nodes: (prev.nodes || []).map(n => ({
                    ...n,
                    vms: (n.vms || []).filter(v => v.name !== deletedName && v.id !== deletedName)
                  }))
                };
              });

              // Check if the currently viewed VM was deleted
              setSelectedEntity(prev => {
                if (prev.type === 'vm' && (prev.id === deletedName || selectedVmDetail?.name === deletedName)) {
                  showToast(`가상머신 '${deletedName}'이(가) OpenShift에서 삭제되었습니다.`, 'warning');
                  setSelectedVmDetail(null);
                  return { type: 'cluster', id: 'cluster-01' };
                }
                return prev;
              });
            } else if (msg.type === 'VM_ADDED' || msg.type === 'VM_MODIFIED') {
              const updatedVm = msg.payload;
              if (!updatedVm || !updatedVm.name) return;

              setInventory(prev => {
                if (!prev) return prev;
                const vms = [...(prev.vms || [])];
                const idx = vms.findIndex(v => v.name === updatedVm.name || v.id === updatedVm.name || v.id === updatedVm.id);
                if (idx >= 0) vms[idx] = { ...vms[idx], ...updatedVm };
                else vms.unshift(updatedVm);

                return {
                  ...prev,
                  vms,
                  nodes: (prev.nodes || []).map(n => ({
                    ...n,
                    vms: vms.filter(v => v.node === n.name)
                  }))
                };
              });

              // If currently selected VM is modified, update in real-time!
              setSelectedVmDetail(prev => {
                if (prev && (prev.name === updatedVm.name || prev.id === updatedVm.name || prev.id === updatedVm.id)) {
                  return { ...prev, ...updatedVm };
                }
                return prev;
              });
            } else if (msg.type === 'METRICS_UPDATED' && Array.isArray(msg.payload)) {
              setInventory(prev => {
                if (!prev || !prev.vms) return prev;
                const metricMap = new Map(msg.payload.map(m => [m.name, m.metrics]));
                return {
                  ...prev,
                  vms: prev.vms.map(v => metricMap.has(v.name) ? { ...v, metrics: metricMap.get(v.name) } : v)
                };
              });
              setSelectedVmDetail(prev => {
                if (!prev) return prev;
                const m = msg.payload.find(x => x.name === prev.name);
                if (m && m.metrics) return { ...prev, metrics: m.metrics };
                return prev;
              });
            } else if (msg.type === 'SNAPSHOT_CHANGED') {
              const updatedVm = msg.payload?.vm;
              if (updatedVm) {
                setInventory(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    vms: (prev.vms || []).map(v => (v.name === updatedVm.name || v.id === updatedVm.name) ? { ...v, snapshots: updatedVm.snapshots } : v)
                  };
                });
                setSelectedVmDetail(prev => {
                  if (prev && (prev.name === updatedVm.name || prev.id === updatedVm.name || prev.id === updatedVm.id)) {
                    return { ...prev, snapshots: updatedVm.snapshots };
                  }
                  return prev;
                });
              } else if (selectedEntity.type === 'vm' && selectedEntity.id) {
                fetchVm(selectedEntity.id).then(v => setSelectedVmDetail(v)).catch(() => {});
              }
            } else if (msg.type === 'NODE_CHANGED' && msg.payload) {
              const node = msg.payload;
              setInventory(prev => {
                if (!prev) return prev;
                let nodes = [...(prev.nodes || [])];
                if (node.deleted) {
                  nodes = nodes.filter(n => n.name !== node.name);
                } else {
                  const idx = nodes.findIndex(n => n.name === node.name);
                  if (idx >= 0) nodes[idx] = { ...nodes[idx], ...node };
                  else nodes.push(node);
                }
                return { ...prev, nodes };
              });
            } else if (msg.type === 'NAMESPACES_UPDATED' && msg.payload) {
              if (msg.payload.namespaces) {
                setNamespaces(msg.payload.namespaces);
              } else if (msg.payload.namespace) {
                setNamespaces(prev => {
                  const target = msg.payload.namespace;
                  const idx = prev.findIndex(n => n.name === target.name);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = target;
                    return next;
                  }
                  return [...prev, target];
                });
              } else if (msg.payload.action === 'DELETED') {
                setNamespaces(prev => prev.filter(n => n.name !== msg.payload.name));
              }
            } else if (msg.type === 'EVENT_ADDED' && msg.payload) {
              setInventory(prev => {
                if (!prev) return prev;
                const events = [msg.payload, ...(prev.events || [])].slice(0, 50);
                return { ...prev, events };
              });
            }
          } catch(e) {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectLiveSync, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch(e) {
        reconnectTimeout = setTimeout(connectLiveSync, 3000);
      }
    }

    connectLiveSync();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [showToast, selectedEntity.id, selectedVmDetail?.name]);

  useEffect(() => {
    loadInventory(false);
    // Minimal backup poll (every 30s) since WebSocket provides 1:1 real-time events
    const timer = setInterval(() => {
      loadInventory(true);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Handle entity selection from tree or cards
  const selectEntity = useCallback(async (type, id) => {
    setSelectedEntity({ type, id });
    if (type === 'vm') {
      setRecentVmIds(prev => [id, ...prev.filter(x => x !== id)].slice(0, 6));
      try {
        const vmData = await fetchVm(id);
        setSelectedVmDetail(vmData);
      } catch (e) {
        const fallback = inventory?.vms?.find(v => v.id === id);
        setSelectedVmDetail(fallback || null);
      }
    } else {
      setSelectedVmDetail(null);
    }
  }, [inventory]);

  const openModal = useCallback((modalName, targetVm = null) => {
    setModalTargetVm(targetVm || selectedVmDetail);
    setModals(prev => ({ ...prev, [modalName]: true }));
  }, [selectedVmDetail]);

  const closeModal = useCallback((modalName) => {
    setModals(prev => ({ ...prev, [modalName]: false }));
  }, []);

  const value = {
    theme,
    toggleTheme,
    inventory,
    loading,
    error,
    selectedEntity,
    selectedVmDetail,
    activeVmTab,
    setActiveVmTab,
    selectEntity,
    loadInventory,
    modals,
    modalTargetVm,
    openModal,
    closeModal,
    toast,
    showToast,
    // Sprint 1 & 2 Core Extensions
    tasks,
    addTask,
    updateTask,
    isTasksOpen,
    setIsTasksOpen,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    contextMenu,
    setContextMenu,
    closeContextMenu,
    powerModal,
    openPowerModal,
    closePowerModal,
    viewMode,
    setViewMode,
    pinnedVmIds,
    togglePinVm,
    recentVmIds,
    // Multi-Namespace (Project) Global State
    namespaces,
    setNamespaces,
    selectedNamespace,
    setSelectedNamespace: handleSetSelectedNamespace,
    showSystemProjects,
    setShowSystemProjects,
    toggleShowSystemProjects
  };

  return (
    <ClusterContext.Provider value={value}>
      {children}
    </ClusterContext.Provider>
  );
}

export function useCluster() {
  const ctx = useContext(ClusterContext);
  if (!ctx) throw new Error('useCluster must be used within ClusterProvider');
  return ctx;
}
