import React, { useState, useMemo } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { 
  Building2, 
  Boxes, 
  Server, 
  Monitor, 
  HardDrive, 
  Network, 
  ChevronDown, 
  ChevronRight,
  Search,
  X
} from 'lucide-react';

export default function LeftSidebarTree() {
  const { 
    inventory, 
    selectedEntity, 
    selectEntity,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    setContextMenu,
    selectedNamespace,
    setSelectedNamespace
  } = useCluster();

  // Collapsible tree nodes
  const [expanded, setExpanded] = useState({
    datacenter: true,
    cluster: true,
    nodes: true,
    vms: true,
    datastores: false,
    networks: false
  });

  const toggle = (section, e) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const isSelected = (type, id) => {
    return selectedEntity?.type === type && selectedEntity?.id === id;
  };

  // Right Click Context Menu Trigger for VMs
  const handleVmContextMenu = (e, vm) => {
    e.preventDefault();
    e.stopPropagation();
    // Auto-select VM on right-click for consistency
    selectEntity('vm', vm.id);
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      entityType: 'vm',
      entityData: vm
    });
  };

  // Filtered VMs based on project namespace, search and status
  const filteredVms = useMemo(() => {
    if (!inventory?.vms) return [];
    return inventory.vms.filter(vm => {
      // 0. Namespace Filter
      if (selectedNamespace !== 'all' && (vm.namespace || 'default') !== selectedNamespace) {
        return false;
      }

      // 1. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'Running' && vm.status !== 'Running') return false;
        if (statusFilter === 'Stopped' && vm.status !== 'Stopped') return false;
        if (statusFilter === 'Error' && !['Error', 'Warning', 'CrashLoopBackOff'].includes(vm.status)) return false;
      }

      // 2. Search Query (Regex or substring)
      if (searchQuery.trim()) {
        try {
          const regex = new RegExp(searchQuery.trim(), 'i');
          const matchName = regex.test(vm.name);
          const matchOs = regex.test(vm.os || '');
          const matchIp = regex.test(vm.ip || '');
          const matchNode = regex.test(vm.node || '');
          if (!matchName && !matchOs && !matchIp && !matchNode) return false;
        } catch {
          const q = searchQuery.toLowerCase();
          const matchName = vm.name.toLowerCase().includes(q);
          const matchOs = (vm.os || '').toLowerCase().includes(q);
          if (!matchName && !matchOs) return false;
        }
      }

      return true;
    });
  }, [inventory, selectedNamespace, searchQuery, statusFilter]);

  // Filtered Nodes based on search
  const filteredNodes = useMemo(() => {
    if (!inventory?.nodes) return [];
    if (!searchQuery.trim()) return inventory.nodes;
    const q = searchQuery.toLowerCase();
    return inventory.nodes.filter(n => 
      n.name.toLowerCase().includes(q) || (n.ip && n.ip.includes(q))
    );
  }, [inventory, searchQuery]);

  // Status Counts scoped to selected namespace
  const counts = useMemo(() => {
    let vms = inventory?.vms || [];
    if (selectedNamespace !== 'all') {
      vms = vms.filter(v => (v.namespace || 'default') === selectedNamespace);
    }
    return {
      all: vms.length,
      running: vms.filter(v => v.status === 'Running').length,
      stopped: vms.filter(v => v.status === 'Stopped').length,
      error: vms.filter(v => ['Error', 'Warning', 'CrashLoopBackOff'].includes(v.status)).length
    };
  }, [inventory, selectedNamespace]);

  return (
    <aside className="left-sidebar-tree">
      {/* 1. Header Title Bar */}
      <div className="sidebar-tree-header">
        <span className="sidebar-title">인벤토리 (Inventory)</span>
        <span className="sidebar-count-badge">전체 {counts.all}대</span>
      </div>
      
      {/* 2. Real-time Search Box */}
      <div className="tree-search-wrapper">
        <Search size={13} className="search-icon" />
        <input 
          type="text"
          className="tree-search-input"
          placeholder="가상머신, 호스트 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button 
            type="button" 
            className="clear-search-btn" 
            onClick={() => setSearchQuery('')}
            title="검색어 초기화"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* 3. Status Filter Chips */}
      <div className="tree-filter-chips">
        <button 
          type="button" 
          className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <span>전체</span>
          <span className="chip-badge">{counts.all}</span>
        </button>
        <button 
          type="button" 
          className={`filter-chip chip-running ${statusFilter === 'Running' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'Running' ? 'all' : 'Running')}
        >
          <span className="chip-dot running" />
          <span>실행 중</span>
          <span className="chip-badge">{counts.running}</span>
        </button>
        <button 
          type="button" 
          className={`filter-chip chip-stopped ${statusFilter === 'Stopped' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'Stopped' ? 'all' : 'Stopped')}
        >
          <span className="chip-dot stopped" />
          <span>정지</span>
          <span className="chip-badge">{counts.stopped}</span>
        </button>
        {counts.error > 0 && (
          <button 
            type="button" 
            className={`filter-chip chip-error ${statusFilter === 'Error' ? 'active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'Error' ? 'all' : 'Error')}
          >
            <span className="chip-dot error" />
            <span>오류</span>
            <span className="chip-badge">{counts.error}</span>
          </button>
        )}
      </div>

      {/* Active Project Filter Banner */}
      {selectedNamespace !== 'all' && (
        <div className="active-namespace-banner">
          <div className="ns-banner-left">
            <span className="ns-banner-tag">PROJECT</span>
            <strong className="ns-banner-name" title={`현재 선택된 프로젝트: ${selectedNamespace}`}>
              {selectedNamespace}
            </strong>
          </div>
          <button 
            type="button" 
            className="ns-banner-clear-btn" 
            onClick={() => setSelectedNamespace('all')}
            title="모든 프로젝트 보기로 초기화"
          >
            <span>전체 보기</span>
            <X size={11} />
          </button>
        </div>
      )}

      {/* 2. Tree Content Scroll */}
      <div className="tree-content-scroll">
        {/* Datacenter Root */}
        <div className="tree-node-group">
          <div 
            className={`tree-item ${isSelected('datacenter', inventory?.datacenter?.id) ? 'selected' : ''}`}
            onClick={() => selectEntity('datacenter', inventory?.datacenter?.id || 'dc-01')}
          >
            <span className="tree-arrow" onClick={(e) => toggle('datacenter', e)}>
              {expanded.datacenter ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <Building2 size={16} className="tree-icon dc-icon" />
            <span className="tree-label">{inventory?.datacenter?.name || 'Enterprise-Seoul-DC'}</span>
          </div>

          {expanded.datacenter && (
            <div className="tree-children">
              {/* Cluster Node */}
              <div 
                className={`tree-item ${isSelected('cluster', inventory?.cluster?.id) ? 'selected' : ''}`}
                onClick={() => selectEntity('cluster', inventory?.cluster?.id || 'cluster-01')}
              >
                <span className="tree-arrow" onClick={(e) => toggle('cluster', e)}>
                  {expanded.cluster ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <Boxes size={16} className="tree-icon cluster-icon" />
                <span className="tree-label">{inventory?.cluster?.name || 'rhov-prod-cluster'}</span>
              </div>

              {expanded.cluster && (
                <div className="tree-children">
                  {/* Hosts Section */}
                  <div className="tree-section-header" onClick={(e) => toggle('nodes', e)}>
                    <span className="tree-arrow">
                      {expanded.nodes ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    <Server size={14} />
                    <span>호스트 노드 ({filteredNodes.length})</span>
                  </div>

                  {expanded.nodes && (
                    <div className="tree-children">
                      {filteredNodes.map(node => (
                        <div key={node.id} className="tree-node-subgroup">
                          <div 
                            className={`tree-item ${isSelected('node', node.id) ? 'selected' : ''}`}
                            onClick={() => selectEntity('node', node.id)}
                          >
                            <span className="tree-bullet">•</span>
                            <Server size={15} className="tree-icon host-icon" />
                            <span className="tree-label" title={node.name}>
                              {node.name.split('.')[0]}
                            </span>
                            <span className={`status-indicator-dot ${node.status === 'Ready' ? 'online' : 'offline'}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Virtual Machines Section */}
                  <div className="tree-section-header" onClick={(e) => toggle('vms', e)}>
                    <span className="tree-arrow">
                      {expanded.vms ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    <Monitor size={14} />
                    <span>가상머신 ({filteredVms.length} / {inventory?.vms?.length || 0})</span>
                  </div>

                  {expanded.vms && (
                    <div className="tree-children">
                      {filteredVms.length === 0 ? (
                        <div className="tree-empty-message">조건에 맞는 VM이 없습니다.</div>
                      ) : (
                        filteredVms.map(vm => {
                          const isRunning = vm.status === 'Running';
                          return (
                            <div 
                              key={vm.id}
                              className={`tree-item vm-tree-item ${isSelected('vm', vm.id) ? 'selected' : ''}`}
                              onClick={() => selectEntity('vm', vm.id)}
                              onContextMenu={(e) => handleVmContextMenu(e, vm)}
                              title="우클릭: 전원, 콘솔, 마이그레이션 등 빠른 메뉴"
                            >
                              <span className="tree-bullet">•</span>
                              <Monitor size={15} className={`tree-icon ${isRunning ? 'vm-running' : 'vm-stopped'}`} />
                              <span className="tree-label vm-item-label-row">
                                <span className="vm-item-name">{vm.name}</span>
                                {selectedNamespace === 'all' && (
                                  <span className="vm-tree-ns-pill" title={`네임스페이스: ${vm.namespace || 'default'}`}>
                                    {vm.namespace || 'default'}
                                  </span>
                                )}
                              </span>
                              <span className={`status-indicator-dot ${isRunning ? 'online' : 'offline'}`} />
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Datastores Section */}
                  <div 
                    className={`tree-section-header ${(selectedEntity?.type === 'datastores' || selectedEntity?.type === 'datastore') ? 'active-category' : ''}`} 
                    onClick={() => selectEntity('datastores')}
                  >
                    <span className="tree-arrow" onClick={(e) => { e.stopPropagation(); toggle('datastores', e); }}>
                      {expanded.datastores ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    <HardDrive size={14} />
                    <span>데이터스토어 ({inventory?.datastores?.length || 2})</span>
                  </div>

                  {expanded.datastores && (
                    <div className="tree-children">
                      {inventory?.datastores?.map((ds, idx) => {
                        const isSelected = selectedEntity?.type === 'datastore' && selectedEntity?.id === ds.id;
                        return (
                          <div 
                            key={idx} 
                            className={`tree-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => selectEntity('datastore', ds.id)}
                            title={`클릭하여 '${ds.name}' 데이터스토어 상세 뷰 열기`}
                          >
                            <span className="tree-bullet">•</span>
                            <HardDrive size={14} className="tree-icon" />
                            <span className="tree-label">{ds.name}</span>
                            {(() => {
                              const isDsRwx = ds.liveMigrationReady || (ds.rwxSupported && !ds.name?.toLowerCase().includes('thin') && !ds.storageClass?.toLowerCase().includes('thin') && !ds.provisioner?.toLowerCase().includes('vsphere'));
                              return (
                                <span className={`tree-meta-type ${isDsRwx ? 'badge-rwx' : 'badge-rwo'}`}>
                                  {isDsRwx ? 'RWX' : 'RWO'}
                                </span>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Networks Section */}
                  <div 
                    className={`tree-section-header ${(selectedEntity?.type === 'networks' || selectedEntity?.type === 'network') ? 'active-category' : ''}`} 
                    onClick={() => selectEntity('networks')}
                  >
                    <span className="tree-arrow" onClick={(e) => { e.stopPropagation(); toggle('networks', e); }}>
                      {expanded.networks ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    <Network size={14} />
                    <span>네트워크 ({inventory?.networks?.length || 2})</span>
                  </div>

                  {expanded.networks && (
                    <div className="tree-children">
                      {inventory?.networks?.map((net, idx) => {
                        const isSelected = selectedEntity?.type === 'network' && selectedEntity?.id === net.id;
                        return (
                          <div 
                            key={idx} 
                            className={`tree-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => selectEntity('network', net.id)}
                            title={`클릭하여 '${net.name}' 가상 스위치/네트워크 상세 뷰 열기`}
                          >
                            <span className="tree-bullet">•</span>
                            <Network size={14} className="tree-icon" />
                            <span className="tree-label">{net.name}</span>
                            <span className="tree-meta-type">[{net.vlan || net.type?.split(' ')[0]}]</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
