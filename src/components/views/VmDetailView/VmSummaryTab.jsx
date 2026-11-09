import React, { useState } from 'react';
import { useCluster } from '../../../context/ClusterContext';
import { powerVm, deleteVm, openWebConsole } from '../../../utils/api';
import { 
  Play, 
  Square, 
  RotateCw, 
  Sliders, 
  Camera, 
  MoveRight, 
  Trash2, 
  ExternalLink,
  Cpu, 
  Database, 
  HardDrive, 
  Network,
  Terminal,
  Activity,
  Copy
} from 'lucide-react';

export default function VmSummaryTab() {
  const { selectedVmDetail, openModal, openPowerModal, showToast } = useCluster();
  const vm = selectedVmDetail;
  const [acting, setActing] = useState(false);

  if (!vm) return null;
  const isRunning = vm.status === 'Running';
  const hasGuestAgent = vm.guestAgent?.installed;

  const handleDelete = () => {
    openModal('deleteVm', vm);
  };

  return (
    <div className="vm-summary-tab-content">
      {/* 0. Guest Agent Warning Banner if missing or inactive */}
      {!hasGuestAgent && isRunning && (
        <div className="guest-agent-warning-banner">
          <Activity size={16} className="warning-icon" />
          <div className="warning-content">
            <strong>QEMU Guest Agent 미연결</strong>: 게스트 OS 내부의 정확한 IP 수집 및 파일시스템 동기화(ACPI)를 위해 <code>qemu-guest-agent</code> 서비스 설치 및 활성화가 필요합니다.
          </div>
        </div>
      )}

      {/* 1. Action Toolbar */}
      <div className="vm-action-toolbar">
        {isRunning ? (
          <>
            <button 
              className="vm-action-btn red" 
              onClick={() => openPowerModal(vm, 'shutdown')} 
              disabled={acting} 
              title="게스트 OS 안전 셧다운 또는 강제 전원 차단"
            >
              <Square size={14} />
              <span>전원 제어 (Power Management)</span>
            </button>
            <button 
              className="vm-action-btn orange" 
              onClick={() => openPowerModal(vm, 'restart')} 
              disabled={acting} 
              title="가상머신 재시작"
            >
              <RotateCw size={14} />
              <span>재시작 (Restart)</span>
            </button>
          </>
        ) : (
          <button 
            className="vm-action-btn green" 
            onClick={() => openPowerModal(vm, 'start')} 
            disabled={acting} 
            title="가상머신 시작"
          >
            <Play size={14} />
            <span>전원 켜기 (Power On)</span>
          </button>
        )}

        <div className="toolbar-divider" />

        <button className="vm-action-btn blue" onClick={() => openWebConsole(vm)} disabled={!isRunning} title="새 창으로 실시간 VNC 웹 콘솔 열기">
          <Terminal size={14} />
          <span>웹 콘솔 실행</span>
        </button>

        <button className="vm-action-btn" onClick={() => openModal('editSpecs', vm)} title="vCPU, RAM, 디스크(무중단 핫플러그), NIC 사양 변경">
          <Sliders size={14} />
          <span>하드웨어 사양 편집</span>
        </button>

        <button className="vm-action-btn" onClick={() => openModal('snapshot', vm)} title="현재 상태 스냅샷 생성">
          <Camera size={14} />
          <span>스냅샷 생성</span>
        </button>

        <button className="vm-action-btn" onClick={() => openModal('migrate', vm)} disabled={!isRunning} title="다른 호스트 노드로 무중단 실시간 마이그레이션">
          <MoveRight size={14} />
          <span>라이브 마이그레이션</span>
        </button>

        <button className="vm-action-btn" onClick={() => openModal('clone', vm)} title="현재 가상머신을 기반으로 새 VM 복제 생성">
          <Copy size={14} />
          <span>가상머신 복제</span>
        </button>

        <div className="toolbar-divider" />

        <button className="vm-action-btn danger-outline" onClick={handleDelete} disabled={acting} title="가상머신 완전 삭제">
          <Trash2 size={14} />
          <span>삭제</span>
        </button>
      </div>

      {/* 2. Main Summary Grid */}
      <div className="vm-summary-two-col">
        {/* Left Column: Screen Thumbnail & Guest OS Details */}
        <div className="vm-summary-col">
          {/* Web Console Thumbnail Box */}
          <div className="content-panel console-thumb-panel">
            <div className="panel-header">
              <span className="panel-title">가상머신 화면 썸네일 (Web Console)</span>
              <span className={`status-pill-badge ${isRunning ? 'online' : 'offline'}`}>
                {isRunning ? '60 FPS Live VNC' : '전원 꺼짐'}
              </span>
            </div>
            <div 
              className={`console-thumb-box ${isRunning ? 'clickable' : ''}`}
              onClick={() => isRunning && openWebConsole(vm)}
              title={isRunning ? '클릭하여 실시간 웹 콘솔 새 창 열기' : '가상머신이 꺼져 있습니다'}
            >
              {isRunning ? (
                <div className="console-preview-screen">
                  <div className="screen-header-bar">
                    <span className="screen-dot red" />
                    <span className="screen-dot yellow" />
                    <span className="screen-dot green" />
                    <span className="screen-title">{vm.name} (tty1)</span>
                  </div>
                  <div className="screen-content-mock">
                    <div>{vm.os} {vm.kernelVersion || '5.14.0-687.42.1.el9_8.x86_64'} (tty1)</div>
                    <div>{vm.name} login: <span className="screen-cursor">_</span></div>
                  </div>
                  <div className="screen-hover-overlay">
                    <ExternalLink size={20} />
                    <span>실시간 웹 콘솔 새 창 열기</span>
                  </div>
                </div>
              ) : (
                <div className="console-thumb-offline">
                  <Square size={32} color="#64748b" />
                  <span>가상머신이 정지되어 있습니다</span>
                </div>
              )}
            </div>
          </div>

          {/* Guest OS Information Panel */}
          <div className="content-panel" style={{ marginTop: '16px' }}>
            <div className="panel-header">
              <span className="panel-title">게스트 OS 및 런타임 정보</span>
            </div>
            <div className="info-kv-grid">
              <div className="info-kv-row">
                <span className="info-key">운영체제 (OS):</span>
                <span className="info-val"><strong>{vm.os}</strong></span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">프로젝트 (Namespace):</span>
                <span className="info-val"><strong style={{ color: '#0091da' }}>{vm.namespace || 'default'}</strong></span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">IP 주소 (Primary):</span>
                <span className="info-val"><code>{vm.ip || '10.129.2.55'}</code></span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">Pod IP (CNI):</span>
                <span className="info-val"><code>{vm.podIp || '10.129.2.55'}</code></span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">호스트 노드 (Host):</span>
                <span className="info-val">{vm.node || 'rhov-worker-node'}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">가동 시간 (Uptime):</span>
                <span className="info-val">{vm.uptime || 'Running'}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">QEMU 게스트 에이전트:</span>
                <span className="info-val">
                  <span className={`badge-pill ${isRunning ? 'green' : 'gray'}`}>
                    {isRunning ? '정상 작동 (Active)' : '연결 해제'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Hardware Resources */}
        <div className="vm-summary-col">
          {/* CPU & Memory Box */}
          <div className="content-panel">
            <div className="panel-header">
              <span className="panel-title">컴퓨팅 자원 (Compute Allocation)</span>
            </div>
            <div className="summary-cards-grid" style={{ gridTemplateColumns: '1fr 1fr', padding: '12px' }}>
              <div className="summary-card inner-card">
                <div className="card-header">
                  <span className="card-title">vCPU 프로세서</span>
                  <Cpu size={18} color="#0091da" />
                </div>
                <div className="card-value">{vm.vCpu} Cores</div>
                <div className="card-sub">{vm.sockets || 1} 소켓 × {vm.vCpu} 코어 (KVM vCPU)</div>
              </div>
              <div className="summary-card inner-card">
                <div className="card-header">
                  <span className="card-title">메모리 (RAM)</span>
                  <Database size={18} color="#10b981" />
                </div>
                <div className="card-value">{vm.memoryGb} GiB</div>
                <div className="card-sub">동적 메모리 벌루닝(Ballooning) 활성</div>
              </div>
            </div>
          </div>

          {/* Virtual Disks Box */}
          <div className="content-panel" style={{ marginTop: '16px' }}>
            <div className="panel-header">
              <span className="panel-title">가상 디스크 ({vm.disks?.length || 1}개)</span>
              <button className="btn-link" onClick={() => openModal('editSpecs', vm)}>+ 디스크 사양 편집</button>
            </div>
            <div className="device-items-list">
              {(vm.disks || []).map((disk, idx) => (
                <div key={idx} className="device-item-row">
                  <HardDrive size={16} color="#0091da" />
                  <div className="device-item-info">
                    <div className="device-item-name">
                      {disk.name}
                      {idx === 0 && <span className="badge-pill blue" style={{ marginLeft: 6 }}>부트/OS</span>}
                    </div>
                    <div className="device-item-meta">
                      PVC: <code>{disk.pvc || `${vm.name}-${disk.name}`}</code> • 스토리지 클래스: <code>{disk.sc || '기본 스토리지'}</code>
                    </div>
                  </div>
                  <div className="device-item-val">{disk.sizeGb} GiB</div>
                </div>
              ))}
            </div>
          </div>

          {/* Network Adapters Box */}
          <div className="content-panel" style={{ marginTop: '16px' }}>
            <div className="panel-header">
              <span className="panel-title">네트워크 어댑터 ({vm.nics?.length || 1}개)</span>
            </div>
            <div className="device-items-list">
              {(vm.nics || []).map((nic, idx) => (
                <div key={idx} className="device-item-row">
                  <Network size={16} color="#10b981" />
                  <div className="device-item-info">
                    <div className="device-item-name">{nic.name}</div>
                    <div className="device-item-meta">
                      포트그룹: {nic.network} • MAC: <code>{nic.mac || '52:54:00:12:34:56'}</code>
                    </div>
                  </div>
                  <div className="device-item-val"><code>{nic.ip || vm.ip || '-'}</code></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
