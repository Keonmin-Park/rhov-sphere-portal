import React, { useState, useEffect } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { createSnapshot } from '../../utils/api';
import { Camera, X, AlertCircle, Database, CheckCircle2, Loader2, HardDrive } from 'lucide-react';

export default function SnapshotModal() {
  const { 
    modals, 
    closeModal, 
    modalTargetVm, 
    loadInventory, 
    addTask, 
    updateTask, 
    showToast 
  } = useCluster();

  const vm = modalTargetVm;
  const isRunning = vm?.status === 'Running';

  const [snapName, setSnapName] = useState('');
  const [snapDesc, setSnapDesc] = useState('');
  const [includeMemory, setIncludeMemory] = useState(false); // Default to false (Disk-only snapshot)
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Reset form whenever modal opens for a VM
  useEffect(() => {
    if (modals.snapshot && vm) {
      setSnapName('');
      setSnapDesc('');
      setIncludeMemory(false); // Always start unchecked (disk-only) for safety
      setErrorMsg(null);
    }
  }, [modals.snapshot, vm]);

  if (!modals.snapshot || !vm) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalName = snapName.trim() || `snap-${Date.now()}`;

    const memoryLabel = includeMemory ? ' (RAM 메모리 덤프 포함)' : ' (디스크 전용)';
    const taskId = addTask(`스냅샷 생성${memoryLabel}`, `${vm.name} ➔ ${finalName}`);

    try {
      setSubmitting(true);
      setErrorMsg(null);
      updateTask(taskId, { progress: 25 });

      showToast(`'${vm.name}' 스냅샷 '${finalName}' 생성 시작...`, 'info');
      closeModal('snapshot');

      // Call API
      const res = await createSnapshot(vm.id, finalName, snapDesc.trim(), includeMemory);
      updateTask(taskId, { progress: 65 });

      if (res && res.success) {
        setTimeout(async () => {
          updateTask(taskId, {
            progress: 100,
            status: 'Completed',
            error: null
          });
          showToast(`'${vm.name}' 스냅샷 '${finalName}' 생성 완료!`, 'success');
          await loadInventory(true);
        }, 1200);

        setSnapName('');
        setSnapDesc('');
      } else {
        throw new Error(res?.error || res?.message || '스냅샷 생성 실패');
      }
    } catch (err) {
      updateTask(taskId, {
        progress: 100,
        status: 'Failed',
        error: err.message || '스냅샷 생성 오류'
      });
      showToast(`스냅샷 생성 실패: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop active">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={20} color="#0091da" />
            <span className="modal-title">가상머신 스냅샷 생성 — {vm.name}</span>
          </div>
          {!submitting && (
            <button className="modal-close-btn" onClick={() => closeModal('snapshot')}>
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body-scroll">
            {/* Target VM info banner */}
            <div className="target-vm-banner">
              <span className="banner-label">대상 VM:</span>
              <strong className="banner-vm-name">{vm.name}</strong>
              <span className={`banner-vm-status ${vm.status.toLowerCase()}`}>{vm.status}</span>
              <span className="banner-node">({vm.os})</span>
            </div>

            {/* Snapshot Name */}
            <div className="form-group">
              <label className="form-label">
                스냅샷 이름 (Snapshot Name) <span className="req">*</span>
              </label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="예: pre-kernel-upgrade-8.10"
                value={snapName}
                onChange={(e) => setSnapName(e.target.value)}
                required 
                disabled={submitting}
              />
            </div>

            {/* Snapshot Description */}
            <div className="form-group">
              <label className="form-label">스냅샷 설명 및 변경 내역 (Description)</label>
              <textarea 
                className="form-textarea" 
                rows="2" 
                placeholder="스냅샷 생성 사유, 변경 예정 내역을 입력하세요..."
                value={snapDesc}
                onChange={(e) => setSnapDesc(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* RAM Active Memory Dump Option (#141) */}
            <div className="form-group">
              <label className="form-label">메모리 상태 캡처 옵션</label>
              
              <label className={`memory-select-card ${includeMemory ? 'active' : ''} ${!isRunning ? 'disabled' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={includeMemory}
                  onChange={(e) => isRunning && setIncludeMemory(e.target.checked)}
                  disabled={!isRunning || submitting}
                />
                <div className="memory-card-body">
                  <div className="memory-card-title">
                    <Database size={15} className="mem-icon" />
                    <strong>RAM 활성 메모리 상태 포함 (Memory State Snapshot)</strong>
                    {includeMemory ? (
                      <span className="active-badge" style={{ background: '#0091da', color: '#fff' }}>RAM 메모리 덤프 ON</span>
                    ) : (
                      <span className="active-badge" style={{ background: '#334155', color: '#cbd5e1' }}>디스크 전용 (RAM 제외)</span>
                    )}
                  </div>
                  <p className="memory-card-desc">
                    가상머신이 실행 중인 현재 프로세스와 활성 메모리(RAM) 상태를 함께 영구 보존합니다. 
                    스냅샷 복원 시 OS 부팅 과정 없이 <strong>즉시 실행 중인 상태로 복구</strong>됩니다. (Oracle DB, Java 애플리케이션 등 인메모리 캐시 보존에 강력 권장)
                  </p>
                  {!isRunning && (
                    <div className="memory-off-hint">
                      * 가상머신 전원이 꺼져 있는 상태이므로 디스크 스냅샷만 생성됩니다.
                    </div>
                  )}
                </div>
              </label>
            </div>

            {errorMsg && (
              <div className="modal-error-banner">
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="modal-footer">
            <button 
              type="button" 
              className="vsphere-btn secondary" 
              onClick={() => closeModal('snapshot')} 
              disabled={submitting}
            >
              취소
            </button>
            <button 
              type="submit" 
              className="vsphere-btn primary-btn" 
              disabled={submitting}
            >
              {submitting && <Loader2 size={14} className="spin-icon" />}
              <span>{submitting ? '스냅샷 생성 중...' : '스냅샷 생성'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
