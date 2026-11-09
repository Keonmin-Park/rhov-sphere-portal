import React from 'react';
import { useCluster } from '../../../context/ClusterContext';
import VmSummaryTab from './VmSummaryTab';
import VmMonitorTab from './VmMonitorTab';
import VmConfigureTab from './VmConfigureTab';
import VmSnapshotsTab from './VmSnapshotsTab';
import VmEventsTab from './VmEventsTab';
import VmYamlView from './VmYamlView';
import { Monitor, Activity, Sliders, Camera, FileText, Code2, LayoutDashboard, Star } from 'lucide-react';

export default function VmDetailView() {
  const { 
    selectedVmDetail, 
    activeVmTab, 
    setActiveVmTab, 
    viewMode, 
    setViewMode,
    pinnedVmIds,
    togglePinVm 
  } = useCluster();
  const vm = selectedVmDetail;

  if (!vm) {
    return (
      <div className="view-container">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
          가상머신 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  const isRunning = vm.status === 'Running';
  const isPinned = pinnedVmIds?.includes(vm.id);

  return (
    <div className="view-container">
      {/* VM Detail Header */}
      <div className="view-header">
        <div className="view-header-top-row">
          <div className="view-header-title-wrap">
            <Monitor size={26} color={isRunning ? '#10b981' : '#64748b'} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 className="view-title">{vm.name}</h1>
                <button 
                  type="button"
                  className={`star-pin-btn ${isPinned ? 'pinned' : ''}`}
                  onClick={() => togglePinVm(vm.id)}
                  title={isPinned ? '즐겨찾기 핀 해제' : '상단 바에 즐겨찾기 핀 고정'}
                >
                  <Star size={17} fill={isPinned ? '#f59e0b' : 'none'} color={isPinned ? '#f59e0b' : 'var(--text-muted)'} />
                </button>
                <span className={`status-pill-badge ${isRunning ? 'online' : 'offline'}`}>
                  {isRunning ? '실행 중 (Running)' : '꺼짐 (Stopped)'}
                </span>
              </div>
              <div className="view-subtitle">
                {vm.os} • 프로젝트: <strong style={{ color: '#0091da' }}>{vm.namespace || 'default'}</strong> • 호스트: <strong>{vm.node || 'rhov-worker-node'}</strong> • IP: <code>{vm.ip || '-'}</code>
              </div>
            </div>
          </div>

          {/* Operator vs Developer View Switch (#197) */}
          <div className="view-mode-switch-group">
            <button 
              type="button"
              className={`mode-switch-btn ${viewMode === 'gui' ? 'active' : ''}`}
              onClick={() => setViewMode('gui')}
              title="vSphere 스타일 표준 관리자 GUI 화면"
            >
              <LayoutDashboard size={14} />
              <span>vSphere 운영자 뷰</span>
            </button>
            <button 
              type="button"
              className={`mode-switch-btn ${viewMode === 'yaml' ? 'active' : ''}`}
              onClick={() => setViewMode('yaml')}
              title="KubeVirt VirtualMachine CRD 원본 YAML 화면"
            >
              <Code2 size={14} />
              <span>K8s YAML 뷰</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Only in GUI View) */}
        {viewMode === 'gui' && (
          <div className="view-header-tabs-row">
            <div className="header-tabs">
              <button 
                type="button"
                className={`tab-btn ${activeVmTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveVmTab('summary')}
              >
                요약 (Summary)
              </button>
              <button 
                type="button"
                className={`tab-btn ${activeVmTab === 'monitor' ? 'active' : ''}`}
                onClick={() => setActiveVmTab('monitor')}
              >
                <Activity size={14} style={{ marginRight: 6 }} />
                모니터 (Monitor)
              </button>
              <button 
                type="button"
                className={`tab-btn ${activeVmTab === 'configure' ? 'active' : ''}`}
                onClick={() => setActiveVmTab('configure')}
              >
                <Sliders size={14} style={{ marginRight: 6 }} />
                구성 (Configure)
              </button>
              <button 
                type="button"
                className={`tab-btn ${activeVmTab === 'snapshots' ? 'active' : ''}`}
                onClick={() => setActiveVmTab('snapshots')}
              >
                <Camera size={14} style={{ marginRight: 6 }} />
                스냅샷 ({vm.snapshots?.length || 0})
              </button>
              <button 
                type="button"
                className={`tab-btn ${activeVmTab === 'events' ? 'active' : ''}`}
                onClick={() => setActiveVmTab('events')}
              >
                <FileText size={14} style={{ marginRight: 6 }} />
                이벤트 (Events)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Render Active View / Tab */}
      <div className="vm-tab-body">
        {viewMode === 'yaml' ? (
          <VmYamlView vm={vm} />
        ) : (
          <>
            {activeVmTab === 'summary' && <VmSummaryTab />}
            {activeVmTab === 'monitor' && <VmMonitorTab />}
            {activeVmTab === 'configure' && <VmConfigureTab />}
            {activeVmTab === 'snapshots' && <VmSnapshotsTab />}
            {activeVmTab === 'events' && <VmEventsTab />}
          </>
        )}
      </div>
    </div>
  );
}
