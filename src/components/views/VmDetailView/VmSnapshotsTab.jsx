import React, { useState } from 'react';
import { useCluster } from '../../../context/ClusterContext';
import { revertSnapshot, deleteSnapshot } from '../../../utils/api';
import { 
  Camera, 
  RotateCcw, 
  Trash2, 
  CheckCircle2, 
  Database, 
  HardDrive, 
  Clock, 
  PlusCircle, 
  AlertTriangle,
  Loader2,
  Calendar,
  X
} from 'lucide-react';

export default function VmSnapshotsTab() {
  const { 
    selectedVmDetail, 
    openModal, 
    loadInventory, 
    addTask, 
    updateTask, 
    showToast 
  } = useCluster();

  const vm = selectedVmDetail;
  const [acting, setActing] = useState(false);
  const [confirmRevertSnap, setConfirmRevertSnap] = useState(null);

  if (!vm) return null;
  const snapshots = vm.snapshots || [];

  const executeRevert = async (snap) => {
    const taskId = addTask('스냅샷 시점 원클릭 복원 (Revert Snapshot)', `${vm.name} ➔ ${snap.name}`);
    setActing(true);
    setConfirmRevertSnap(null);

    try {
      showToast(`'${snap.name}' 스냅샷 시점으로 복원 시작...`, 'info');
      updateTask(taskId, { progress: 30 });

      // Step 1: Revert API call
      const res = await revertSnapshot(vm.id, snap.id || snap.name);
      updateTask(taskId, { progress: 70 });

      setTimeout(() => {
        updateTask(taskId, {
          progress: 100,
          status: 'Completed',
          error: null
        });
        showToast(`'${vm.name}'이(가) 스냅샷 '${snap.name}' 시점으로 성공적으로 복원되었습니다.`, 'success');
        loadInventory(true);
        setActing(false);
      }, 1500);

    } catch (e) {
      updateTask(taskId, {
        progress: 100,
        status: 'Failed',
        error: e.message || '스냅샷 복원 실패'
      });
      showToast(`스냅샷 복원 실패: ${e.message}`, 'error');
      setActing(false);
    }
  };

  const handleDelete = async (snap) => {
    if (!confirm(`스냅샷 '${snap.name}'을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    const taskId = addTask('스냅샷 삭제 (Delete Snapshot)', `${vm.name} ➔ ${snap.name}`);
    try {
      setActing(true);
      showToast(`'${snap.name}' 스냅샷 삭제 중...`, 'info');
      updateTask(taskId, { progress: 40 });

      await deleteSnapshot(vm.id, snap.name);
      updateTask(taskId, {
        progress: 100,
        status: 'Completed',
        error: null
      });

      showToast(`'${snap.name}' 스냅샷 삭제 완료`, 'success');
      loadInventory(true);
    } catch (e) {
      updateTask(taskId, {
        progress: 100,
        status: 'Failed',
        error: e.message
      });
      showToast(`스냅샷 삭제 실패: ${e.message}`, 'error');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="vm-snapshots-tab-content">
      {/* 1. Header Toolbar */}
      <div className="snapshots-header-panel">
        <div className="header-left">
          <Camera size={20} className="icon-blue" />
          <div>
            <h3 className="snapshots-title">가상머신 스냅샷 계층 타임라인 ({snapshots.length}개 보유)</h3>
            <p className="snapshots-subtitle">과거 백업 시점으로 시스템과 메모리 상태를 1초 만에 롤백 복원합니다.</p>
          </div>
        </div>
        <button 
          className="header-btn-primary" 
          onClick={() => openModal('snapshot', vm)}
          disabled={acting}
        >
          <PlusCircle size={15} />
          <span>새 스냅샷 생성</span>
        </button>
      </div>

      {/* 2. Snapshot Timeline Tree View (#142) */}
      <div className="snapshots-timeline-container">
        {/* Current State "You Are Here" Marker */}
        <div className="timeline-node current-state">
          <div className="timeline-point current">
            <span className="pulse-ring" />
            <span className="dot" />
          </div>
          <div className="timeline-card current">
            <div className="card-top-row">
              <span className="you-are-here-badge">📍 현재 상태 (You Are Here)</span>
              <span className="current-status-tag">{vm.status}</span>
            </div>
            <div className="current-vm-summary">
              현재 실행 중인 런타임 상태 ({vm.vCpu} vCPU, {vm.memoryGb} GB RAM)
            </div>
          </div>
        </div>

        {/* Snapshots History Timeline */}
        {snapshots.length === 0 ? (
          <div className="no-snapshots-banner">
            <Clock size={28} className="empty-icon" />
            <p>보유 중인 스냅샷이 없습니다.</p>
            <span>상단의 [새 스냅샷 생성] 버튼을 눌러 시스템 변경 전 복원 지점을 만들어두세요.</span>
          </div>
        ) : (
          snapshots.map((snap, idx) => {
            const hasMemory = snap.includeMemory === true || snap.memoryIncluded === true;
            return (
              <div key={snap.id || idx} className="timeline-node">
                <div className="timeline-point snapshot">
                  <Camera size={13} className="point-icon" />
                </div>

                <div className="timeline-card snapshot-card">
                  <div className="card-top-row">
                    <strong className="snap-title">{snap.name}</strong>
                    
                    {hasMemory ? (
                      <span className="snap-mem-badge with-mem" title="RAM 메모리 상태 포함 스냅샷">
                        <Database size={11} /> RAM 메모리 덤프 포함
                      </span>
                    ) : (
                      <span className="snap-mem-badge disk-only" title="디스크 상태만 저장된 스냅샷">
                        <HardDrive size={11} /> 디스크 전용
                      </span>
                    )}

                    <span className="snap-date-pill">
                      <Calendar size={11} />
                      {snap.created || snap.time || '2026-10-20 16:50'}
                    </span>
                  </div>

                  <p className="snap-desc-text">
                    {snap.desc || snap.description || '정기 시스템 백업 지점 (KubeVirt VirtualMachineSnapshot)'}
                  </p>

                  <div className="snap-card-footer">
                    <span className="snap-size-meta">점유 용량: {snap.sizeGb || 50} GiB</span>

                    <div className="snap-action-buttons">
                      <button 
                        type="button"
                        className="snap-btn revert"
                        onClick={() => setConfirmRevertSnap(snap)}
                        disabled={acting}
                        title="이 스냅샷 시점으로 가상머신 상태를 즉시 복원"
                      >
                        <RotateCcw size={13} />
                        <span>이 시점으로 복원 (Revert)</span>
                      </button>

                      <button 
                        type="button"
                        className="snap-btn delete"
                        onClick={() => handleDelete(snap)}
                        disabled={acting}
                        title="스냅샷 삭제"
                      >
                        <Trash2 size={13} />
                        <span>삭제</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Revert Confirmation Modal (#142) */}
      {confirmRevertSnap && (
        <div className="modal-backdrop active" onClick={() => setConfirmRevertSnap(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-box">
                <RotateCcw size={18} className="modal-header-icon" />
                <span className="modal-title">스냅샷 시점 복원 확인 (Revert Snapshot)</span>
              </div>
              <button className="modal-close-btn" onClick={() => setConfirmRevertSnap(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body-scroll">
              <div className="revert-warning-banner">
                <AlertTriangle size={20} className="warn-icon" />
                <div className="warn-content">
                  <strong>주의: 현재 실행 중인 모든 작업과 변경 사항이 삭제됩니다!</strong>
                  <p>
                    가상머신 <code>{vm.name}</code>의 파일시스템 및 메모리 상태가 
                    스냅샷 <strong>'{confirmRevertSnap.name}'</strong>({confirmRevertSnap.created || confirmRevertSnap.time || '지정 시점'})으로 완전히 되돌아갑니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="vsphere-btn secondary"
                onClick={() => setConfirmRevertSnap(null)}
              >
                취소
              </button>
              <button 
                type="button" 
                className="vsphere-btn danger-btn"
                onClick={() => executeRevert(confirmRevertSnap)}
              >
                {acting ? <Loader2 size={14} className="spin-icon" /> : <RotateCcw size={14} />}
                <span>스냅샷 시점으로 복원 실행</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
