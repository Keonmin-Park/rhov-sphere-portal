import React, { useState, useRef, useEffect } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { 
  Server, 
  Search, 
  PlusCircle, 
  Sun, 
  Moon, 
  RefreshCw, 
  Radio, 
  Layers,
  Star,
  History,
  Clock,
  X,
  Monitor,
  Folder,
  FolderPlus,
  ChevronDown,
  Check,
  Filter
} from 'lucide-react';

export default function TopHeader() {
  const { 
    theme, 
    toggleTheme, 
    inventory, 
    loading, 
    loadInventory, 
    openModal, 
    selectEntity,
    pinnedVmIds,
    togglePinVm,
    recentVmIds,
    namespaces,
    selectedNamespace,
    setSelectedNamespace,
    showSystemProjects,
    toggleShowSystemProjects
  } = useCluster();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);
  const recentMenuRef = useRef(null);

  // Project (Namespace) Dropdown State
  const [showNsDropdown, setShowNsDropdown] = useState(false);
  const [nsSearch, setNsSearch] = useState('');
  const nsDropdownRef = useRef(null);

  // Close recent dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (recentMenuRef.current && !recentMenuRef.current.contains(e.target)) {
        setShowRecentDropdown(false);
      }
      if (nsDropdownRef.current && !nsDropdownRef.current.contains(e.target)) {
        setShowNsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Dynamic OpenShift Cluster Version (dynamically parsed from cluster inventory/state)
  const displayVersion = React.useMemo(() => {
    const raw = inventory?.cluster?.ocpVersion || inventory?.cluster?.version;
    if (raw) {
      const match = raw.match(/OpenShift\s+([0-9]+(?:\.[0-9]+)+)/i);
      if (match) {
        return `OpenShift ${match[1]} Live`;
      }
      if (raw.toLowerCase().includes('openshift')) {
        return raw.replace(/\(KubeVirt Live\)/i, '').trim() + ' Live';
      }
      return `OpenShift ${raw} Live`;
    }
    return 'OpenShift 4.22 Live';
  }, [inventory?.cluster?.ocpVersion, inventory?.cluster?.version]);

  // Total and selected VMs count
  const totalVmsCount = inventory?.vms?.length || 0;
  const selectedNsVmCount = selectedNamespace === 'all' 
    ? totalVmsCount 
    : (inventory?.vms || []).filter(v => (v.namespace || 'default') === selectedNamespace).length;

  // Filter namespaces list for dropdown
  const filteredNamespaces = (namespaces || []).filter(n => {
    if (!showSystemProjects && n.isSystem) return false;
    if (nsSearch.trim()) {
      const q = nsSearch.toLowerCase();
      return n.name.toLowerCase().includes(q) || (n.displayName && n.displayName.toLowerCase().includes(q));
    }
    return true;
  });

  const workloadProjects = filteredNamespaces.filter(n => !n.isSystem);
  const systemProjects = filteredNamespaces.filter(n => n.isSystem);

  // Pinned VMs list
  const pinnedVms = (inventory?.vms || []).filter(v => pinnedVmIds?.includes(v.id));

  // Recent Visited VMs list
  const recentVms = (recentVmIds || [])
    .map(id => (inventory?.vms || []).find(v => v.id === id))
    .filter(Boolean);

  // Filter VMs and Nodes for global quick-search
  const filteredVms = inventory?.vms?.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.ip && v.ip.includes(searchQuery))
  ) || [];

  const filteredNodes = inventory?.nodes?.filter(n => 
    n.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleSelectSearchResult = (type, id) => {
    selectEntity(type, id);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  return (
    <header className="top-header">
      {/* Brand & Datacenter Name */}
      <div className="header-brand-group">
        <div className="header-logo-icon">
          <Layers size={22} color="#0091da" />
        </div>
        <div className="header-titles">
          <div className="brand-name">
            RHOV Sphere <span>Client</span>
          </div>
          <div className="datacenter-sub">
            {inventory?.datacenter?.name || 'Enterprise-Seoul-DC'} • {inventory?.cluster?.name || 'rhov-prod-cluster'}
          </div>
        </div>
      </div>

      {/* Global Project / Namespace Selector (#1 Multi-Namespace) */}
      <div className="header-project-selector-wrap" ref={nsDropdownRef}>
        <button 
          type="button"
          className={`project-selector-btn ${selectedNamespace !== 'all' ? 'filtered' : ''}`}
          onClick={() => setShowNsDropdown(prev => !prev)}
          title="클러스터 네임스페이스 / 프로젝트 전환"
        >
          <Folder size={15} className="project-btn-icon" />
          <div className="project-btn-text">
            <span className="project-btn-label">프로젝트:</span>
            <strong className="project-btn-name">
              {selectedNamespace === 'all' ? '모든 프로젝트 (전체)' : selectedNamespace}
            </strong>
          </div>
          <span className="project-vm-badge">{selectedNsVmCount}대</span>
          <ChevronDown size={13} className={`chevron-icon ${showNsDropdown ? 'open' : ''}`} />
        </button>

        {showNsDropdown && (
          <div className="project-dropdown-menu">
            <div className="project-dropdown-header">
              <div className="project-dropdown-title">
                <Folder size={15} color="#0091da" />
                <span>OpenShift 프로젝트 선택</span>
              </div>
              <button 
                type="button" 
                className="new-project-quick-btn"
                onClick={() => {
                  setShowNsDropdown(false);
                  openModal('createNamespace');
                }}
                title="새 OpenShift 프로젝트 생성"
              >
                <FolderPlus size={13} />
                <span>새 프로젝트</span>
              </button>
            </div>

            {/* Quick search input */}
            <div className="project-search-box">
              <Search size={13} className="project-search-icon" />
              <input 
                type="text"
                placeholder="프로젝트명 검색..."
                value={nsSearch}
                onChange={(e) => setNsSearch(e.target.value)}
                autoFocus
              />
              {nsSearch && (
                <button type="button" className="project-search-clear" onClick={() => setNsSearch('')}>
                  &times;
                </button>
              )}
            </div>

            {/* Options list scroll */}
            <div className="project-options-list">
              {/* Option 1: All Projects */}
              <div 
                className={`project-option-item ${selectedNamespace === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedNamespace('all');
                  setShowNsDropdown(false);
                }}
              >
                <div className="project-item-left">
                  <span className="project-all-icon">★</span>
                  <div>
                    <strong className="project-item-title">모든 프로젝트 (전체 보기)</strong>
                    <div className="project-item-desc">클러스터 전체 네임스페이스 VM 통합 관리</div>
                  </div>
                </div>
                <div className="project-item-right">
                  <span className="project-badge all">{totalVmsCount}대</span>
                  {selectedNamespace === 'all' && <Check size={14} className="check-icon" />}
                </div>
              </div>

              {/* Workload Projects Section */}
              <div className="project-section-divider">
                <span>워크로드 프로젝트 ({workloadProjects.length})</span>
              </div>

              {workloadProjects.length === 0 ? (
                <div className="project-empty-item">일치하는 워크로드 프로젝트가 없습니다.</div>
              ) : (
                workloadProjects.map(ns => {
                  const isSelected = selectedNamespace === ns.name;
                  const vmsInNs = (inventory?.vms || []).filter(v => (v.namespace || 'default') === ns.name).length;
                  return (
                    <div 
                      key={ns.name}
                      className={`project-option-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedNamespace(ns.name);
                        setShowNsDropdown(false);
                      }}
                    >
                      <div className="project-item-left">
                        <span className={`ns-dot ${vmsInNs > 0 ? 'has-vms' : 'empty'}`} />
                        <div>
                          <strong className="project-item-title">{ns.name}</strong>
                          {ns.displayName && ns.displayName !== ns.name && (
                            <div className="project-item-desc">{ns.displayName}</div>
                          )}
                        </div>
                      </div>
                      <div className="project-item-right">
                        <span className={`project-badge ${vmsInNs > 0 ? 'active' : 'zero'}`}>
                          {vmsInNs}대
                        </span>
                        {isSelected && <Check size={14} className="check-icon" />}
                      </div>
                    </div>
                  );
                })
              )}

              {/* System Namespaces Divider */}
              <div className="project-section-divider system-divider">
                <span>시스템 네임스페이스</span>
                <label className="system-toggle-label" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox"
                    checked={showSystemProjects}
                    onChange={toggleShowSystemProjects}
                  />
                  <span>표시 ({namespaces.filter(n => n.isSystem).length})</span>
                </label>
              </div>

              {showSystemProjects && (
                systemProjects.map(ns => {
                  const isSelected = selectedNamespace === ns.name;
                  const vmsInNs = (inventory?.vms || []).filter(v => (v.namespace || 'default') === ns.name).length;
                  return (
                    <div 
                      key={ns.name}
                      className={`project-option-item system-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedNamespace(ns.name);
                        setShowNsDropdown(false);
                      }}
                    >
                      <div className="project-item-left">
                        <span className="system-tag">SYS</span>
                        <span className="project-item-title">{ns.name}</span>
                      </div>
                      <div className="project-item-right">
                        {vmsInNs > 0 && <span className="project-badge active">{vmsInNs}대</span>}
                        {isSelected && <Check size={14} className="check-icon" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="project-dropdown-footer">
              <span className="project-count-summary">
                총 {namespaces.length}개 프로젝트 (선택: <strong>{selectedNamespace}</strong>)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Global Quick Search */}
      <div className="header-search-wrap">
        <div className="search-input-box">
          <Search size={15} className="search-icon" />
          <input 
            type="text" 
            placeholder="인벤토리 검색 (VM 이름, IP, 호스트)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(e.target.value.trim().length > 0);
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0) setShowSearchResults(true);
            }}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}>
              &times;
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && (
          <div className="search-dropdown-menu">
            {filteredVms.length === 0 && filteredNodes.length === 0 ? (
              <div className="search-dropdown-empty">일치하는 검색 결과가 없습니다.</div>
            ) : (
              <>
                {filteredVms.length > 0 && (
                  <div className="search-dropdown-section">
                    <div className="search-dropdown-title">가상머신 (VM)</div>
                    {filteredVms.map(vm => (
                      <div 
                        key={vm.id} 
                        className="search-dropdown-item"
                        onClick={() => handleSelectSearchResult('vm', vm.id)}
                      >
                        <span className={`status-dot-sm ${vm.status === 'Running' ? 'online' : 'offline'}`} />
                        <span className="search-item-name">{vm.name}</span>
                        <span className="search-item-meta">{vm.ip} • {vm.vCpu} vCPU</span>
                      </div>
                    ))}
                  </div>
                )}
                {filteredNodes.length > 0 && (
                  <div className="search-dropdown-section">
                    <div className="search-dropdown-title">호스트 노드</div>
                    {filteredNodes.map(node => (
                      <div 
                        key={node.id} 
                        className="search-dropdown-item"
                        onClick={() => handleSelectSearchResult('node', node.id)}
                      >
                        <Server size={14} color="#0091da" />
                        <span className="search-item-name">{node.name.split('.')[0]}</span>
                        <span className="search-item-meta">{node.ip} • {node.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Pinned VMs Quick Bar (#7) */}
      <div className="header-pinned-bar">
        {pinnedVms.map(pvm => {
          const isRunning = pvm.status === 'Running';
          return (
            <div 
              key={pvm.id}
              className="pinned-vm-chip"
              onClick={() => selectEntity('vm', pvm.id)}
              title={`${pvm.name} (${pvm.os}) - 클릭하여 이동`}
            >
              <Star size={11} className="star-icon filled" fill="#f59e0b" color="#f59e0b" />
              <span className={`chip-dot ${isRunning ? 'running' : 'stopped'}`} />
              <span className="pinned-vm-name">{pvm.name}</span>
              <button 
                type="button" 
                className="unpin-btn" 
                onClick={(e) => { e.stopPropagation(); togglePinVm(pvm.id); }}
                title="즐겨찾기 핀 해제"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Header Controls */}
      <div className="header-actions-group">
        {/* Recent Visited VMs History Dropdown (#8) */}
        <div className="recent-history-wrap" ref={recentMenuRef}>
          <button 
            type="button"
            className={`header-icon-btn ${showRecentDropdown ? 'active' : ''}`}
            onClick={() => setShowRecentDropdown(prev => !prev)}
            title="최근 방문한 가상머신 목록"
          >
            <History size={16} />
          </button>

          {showRecentDropdown && (
            <div className="recent-history-dropdown">
              <div className="recent-history-header">
                <Clock size={13} />
                <span>최근 본 가상머신 (Recent VMs)</span>
              </div>
              {recentVms.length === 0 ? (
                <div className="recent-empty">최근 방문 이력이 없습니다.</div>
              ) : (
                <div className="recent-list">
                  {recentVms.map(rvm => (
                    <div 
                      key={rvm.id}
                      className="recent-item"
                      onClick={() => {
                        selectEntity('vm', rvm.id);
                        setShowRecentDropdown(false);
                      }}
                    >
                      <Monitor size={14} className={rvm.status === 'Running' ? 'icon-green' : 'icon-muted'} />
                      <div className="recent-item-info">
                        <strong className="recent-name">{rvm.name}</strong>
                        <span className="recent-meta">{rvm.os} • {rvm.node?.split('.')[0] || 'Node'}</span>
                      </div>
                      <span className={`status-pill ${rvm.status.toLowerCase()}`}>{rvm.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create VM Button */}
        <button 
          className="header-btn-primary" 
          onClick={() => openModal('createVm')}
          title="새 OpenShift 가상머신 생성"
        >
          <PlusCircle size={15} />
          <span>새 가상머신</span>
        </button>

        {/* Live Cluster Status Pill */}
        <div 
          className="cluster-status-pill" 
          onClick={() => openModal('connect')}
          title="클릭하여 OpenShift API Server 및 토큰 설정 확인"
        >
          <Radio size={14} className="pulse-icon" />
          <span>{displayVersion}</span>
        </div>

        {/* Refresh Inventory */}
        <button 
          className={`header-icon-btn ${loading ? 'spinning' : ''}`}
          onClick={() => loadInventory(true)}
          title="인벤토리 새로고침"
        >
          <RefreshCw size={16} />
        </button>

        {/* Dark/Light Theme Toggle */}
        <button 
          className="header-icon-btn" 
          onClick={toggleTheme}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {theme === 'dark' ? <Sun size={17} color="#fbbf24" /> : <Moon size={17} color="#0091da" />}
        </button>
      </div>
    </header>
  );
}
