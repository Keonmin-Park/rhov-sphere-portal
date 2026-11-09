import React, { useState } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { powerVm } from '../../utils/api';
import { 
  Square, 
  PowerOff, 
  Play, 
  RotateCw, 
  AlertTriangle, 
  ShieldCheck, 
  X, 
  Loader2 
} from 'lucide-react';

export default function PowerActionModal() {
  const { 
    powerModal, 
    closePowerModal, 
    loadInventory, 
    addTask, 
    updateTask, 
    showToast 
  } = useCluster();

  const [confirmRisk, setConfirmRisk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState('shutdown');

  const vm = powerModal.targetVm;
  const isRunning = vm?.status === 'Running';

  // Synchronize mode when modal opens
  React.useEffect(() => {
    if (powerModal.isOpen && powerModal.targetVm) {
      const mode = powerModal.mode || (powerModal.targetVm.status === 'Running' ? 'shutdown' : 'start');
      setSelectedMode(mode);
      setConfirmRisk(false);
    }
  }, [powerModal.isOpen, powerModal.mode, powerModal.targetVm]);

  if (!powerModal.isOpen || !powerModal.targetVm) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    let taskName = '';
    let apiAction = '';

    if (selectedMode === 'shutdown') {
      taskName = `게스트 OS 안전 셧다운 (ACPI)`;
      apiAction = 'stop';
    } else if (selectedMode === 'force') {
      taskName = `전원 강제 차단 (Force Power Off)`;
      apiAction = 'stop';
    } else if (selectedMode === 'restart') {
      taskName = `가상머신 재시작 (Restart)`;
      apiAction = 'restart';
    } else {
      taskName = `가상머신 전원 켜기 (Power On)`;
      apiAction = 'start';
    }

    const taskId = addTask(taskName, vm.name);
    setLoading(true);

    try {
      showToast(`'${vm.name}' ${taskName} 명령 전송 중...`, 'info');
      closePowerModal();

      // Step 1: Pre-check phase in Recent Tasks
      updateTask(taskId, { progress: 30 });

      // Step 2: Trigger KubeVirt backend
      await powerVm(vm.id, apiAction);
      updateTask(taskId, { progress: 70 });

      // Step 3: Complete & sync
      setTimeout(async () => {
        updateTask(taskId, {
          progress: 100,
          status: 'Completed',
          error: null
        });
        showToast(`'${vm.name}' ${taskName} 작업 완료`, 'success');
        await loadInventory(true);
      }, 1500);

    } catch (err) {
      updateTask(taskId, {
        progress: 100,
        status: 'Failed',
        error: err.message || 'API 통신 장애'
      });
      showToast(`전원 작업 실패: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop active">
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-title-box">
            <PowerOff size={18} className="modal-header-icon" />
            <span className="modal-title">가상머신 전원 제어 (Power Management)</span>
          </div>
          <button className="modal-close-btn" onClick={closePowerModal}>
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body-scroll">
            <div className="target-vm-banner">
              <span className="banner-label">대상 가상머신:</span>
              <strong className="banner-vm-name">{vm.name}</strong>
              <span className={`banner-vm-status ${vm.status.toLowerCase()}`}>{vm.status}</span>
              <span className="banner-node">({vm.node || 'Node-01'})</span>
            </div>

            {isRunning ? (
              <div className="power-mode-selector">
                {/* 1. Safe ACPI Shutdown */}
                <label className={`mode-card ${selectedMode === 'shutdown' ? 'active safe' : ''}`}>
                  <input 
                    type="radio" 
                    name="powerMode" 
                    value="shutdown"
                    checked={selectedMode === 'shutdown'}
                    onChange={() => setSelectedMode('shutdown')}
                  />
                  <div className="mode-content">
                    <div className="mode-title-row">
                      <ShieldCheck size={16} className="icon-safe" />
                      <span className="mode-title">게스트 OS 정상 셧다운 (Safe Shutdown)</span>
                      <span className="recommend-badge">권장</span>
                    </div>
                    <p className="mode-desc">
                      QEMU Guest Agent와 ACPI 신호를 송신하여 가상머신 내부 파일시스템과 실행 중인 데이터베이스를 안전하게 저장하고 종료합니다.
                    </p>
                  </div>
                </label>

                {/* 2. Restart */}
                <label className={`mode-card ${selectedMode === 'restart' ? 'active restart' : ''}`}>
                  <input 
                    type="radio" 
                    name="powerMode" 
                    value="restart"
                    checked={selectedMode === 'restart'}
                    onChange={() => setSelectedMode('restart')}
                  />
                  <div className="mode-content">
                    <div className="mode-title-row">
                      <RotateCw size={16} className="icon-restart" />
                      <span className="mode-title">가상머신 재시작 (Restart)</span>
                    </div>
                    <p className="mode-desc">
                      가상머신의 운영체제를 재부팅합니다.
                    </p>
                  </div>
                </label>

                {/* 3. Force Power Off */}
                <label className={`mode-card danger ${selectedMode === 'force' ? 'active danger' : ''}`}>
                  <input 
                    type="radio" 
                    name="powerMode" 
                    value="force"
                    checked={selectedMode === 'force'}
                    onChange={() => setSelectedMode('force')}
                  />
                  <div className="mode-content">
                    <div className="mode-title-row">
                      <Square size={16} className="icon-danger" />
                      <span className="mode-title">전원 강제 차단 (Force Power Off)</span>
                      <span className="danger-badge">비상용</span>
                    </div>
                    <p className="mode-desc">
                      응답 없는 비정상 상태에서 QEMU 하이퍼바이저 프로세스를 즉각 강제 중단합니다. 캐시되지 않은 데이터가 유실될 수 있습니다.
                    </p>
                  </div>
                </label>

                {/* Risk Confirmation for Force Stop */}
                {selectedMode === 'force' && (
                  <div className="force-warning-box">
                    <div className="warning-title">
                      <AlertTriangle size={16} />
                      <span>데이터 손실 경고</span>
                    </div>
                    <p className="warning-text">
                      강제 전원 차단은 물리 서버의 전원 코드를 뽑는 것과 같습니다. 파일시스템 정합성 검사(fsck)가 요구되거나 비정상 데이터 오염이 발생할 수 있습니다.
                    </p>
                    <label className="confirm-checkbox-label">
                      <input 
                        type="checkbox"
                        checked={confirmRisk}
                        onChange={(e) => setConfirmRisk(e.target.checked)}
                      />
                      <span>위험 요소를 인지하였으며, 즉시 강제 종료를 실행합니다.</span>
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div className="power-mode-selector">
                <label className="mode-card active start">
                  <input 
                    type="radio" 
                    name="powerMode" 
                    value="start"
                    checked={true}
                    readOnly
                  />
                  <div className="mode-content">
                    <div className="mode-title-row">
                      <Play size={16} className="icon-start" />
                      <span className="mode-title">가상머신 전원 켜기 (Power On)</span>
                    </div>
                    <p className="mode-desc">
                      할당된 노드({vm.node || 'master-01'})에서 가상머신 KubeVirt 파드를 기동하고 부팅 시퀀스를 시작합니다.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="modal-footer">
            <button 
              type="button" 
              className="vsphere-btn secondary"
              onClick={closePowerModal}
              disabled={loading}
            >
              취소
            </button>
            <button 
              type="submit" 
              className={`vsphere-btn ${selectedMode === 'force' ? 'danger-btn' : 'primary-btn'}`}
              disabled={loading || (selectedMode === 'force' && !confirmRisk)}
            >
              {loading && <Loader2 size={14} className="spin-icon" />}
              <span>
                {selectedMode === 'shutdown' && '안전 셧다운 실행'}
                {selectedMode === 'restart' && '재시작 실행'}
                {selectedMode === 'force' && '전원 강제 차단'}
                {selectedMode === 'start' && '가상머신 시작'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
