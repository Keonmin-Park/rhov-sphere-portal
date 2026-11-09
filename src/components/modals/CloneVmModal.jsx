import React, { useState } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { cloneVm } from '../../utils/api';
import { 
  Copy, 
  X, 
  AlertCircle, 
  HardDrive, 
  Cpu, 
  Layers, 
  Zap, 
  CheckCircle2, 
  Loader2, 
  PlaySquare, 
  Database,
  ArrowRight
} from 'lucide-react';

export default function CloneVmModal() {
  const { 
    modals, 
    closeModal, 
    modalTargetVm, 
    inventory,
    loadInventory, 
    addTask, 
    updateTask, 
    showToast,
    namespaces
  } = useCluster();

  const vm = modalTargetVm;

  const getPreferredStorageClass = () => {
    const list = inventory?.datastores || [];
    const preferred = list.find(d => d.isDefaultVirt) ||
                      list.find(d => d.liveMigrationReady && (d.name?.includes('ceph') || d.name?.includes('rbd') || d.name?.includes('ocs'))) ||
                      list.find(d => d.liveMigrationReady) ||
                      list[0];
    return preferred?.storageClass || preferred?.name || vm?.disks?.[0]?.sc || 'ocs-storagecluster-ceph-rbd';
  };

  const [newName, setNewName] = useState('');
  const [targetNamespace, setTargetNamespace] = useState('');
  const [cloneType, setCloneType] = useState('full'); // 'full' | 'linked'
  const [storageClass, setStorageClass] = useState(() => getPreferredStorageClass() || 'ocs-storagecluster-ceph-rbd');
  const [autoStart, setAutoStart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sync defaults when modal opens with target vm
  React.useEffect(() => {
    if (vm) {
      setNewName(`${vm.name}-clone`);
      setTargetNamespace(vm.namespace || 'default');
      setStorageClass(getPreferredStorageClass());
      setErrorMsg(null);
    }
  }, [vm, inventory]);

  if (!modals.clone || !vm) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalName = newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!finalName) {
      setErrorMsg('유효한 가상머신 이름을 입력해주세요.');
      return;
    }

    const typeLabel = cloneType === 'full' ? 'Full Clone' : 'Linked Clone';
    const taskId = addTask(`가상머신 복제 (${typeLabel})`, `${vm.name} ➔ ${finalName}`);

    try {
      setSubmitting(true);
      setErrorMsg(null);
      showToast(`'${vm.name}'을(를) '${finalName}'(으)로 복제 시작...`, 'info');
      closeModal('clone');

      // Step 1: Initial submission
      updateTask(taskId, { progress: 20 });

      // Call API
      const res = await cloneVm(vm.id, {
        newName: finalName,
        targetNamespace,
        storageClass,
        cloneType,
        autoStart
      });

      // Step 2: Storage volume clone in-progress
      updateTask(taskId, { progress: 55 });

      setTimeout(() => {
        // Step 3: NIC & Cloud-init customization
        updateTask(taskId, { progress: 85 });

        setTimeout(() => {
          if (res && (res.success || !res.error)) {
            updateTask(taskId, {
              progress: 100,
              status: 'Completed',
              error: null
            });
            showToast(`가상머신 '${finalName}' 복제 및 등록 완료!`, 'success');
            loadInventory(true);
          } else {
            throw new Error(res?.error || '가상머신 복제 실패');
          }
        }, 1500);
      }, 1500);

    } catch (err) {
      updateTask(taskId, {
        progress: 100,
        status: 'Failed',
        error: err.message || '복제 오류'
      });
      showToast(`복제 실패: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalDiskSize = (vm.disks || []).reduce((acc, d) => acc + (d.sizeGb || 0), 0);

  return (
    <div className="modal-backdrop active">
      <div className="modal-box modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Copy size={20} color="#0091da" />
            <span className="modal-title">가상머신 복제 마법사 (Clone VirtualMachine)</span>
          </div>
          {!submitting && (
            <button className="modal-close-btn" onClick={() => closeModal('clone')}>
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body-scroll">
            {/* 1. Source VM Information Banner */}
            <div className="clone-source-card">
              <div className="source-badge">원본 가상머신 (Source VM)</div>
              <div className="source-info-row">
                <strong className="source-name">{vm.name}</strong>
                <span className={`source-status-pill ${vm.status?.toLowerCase()}`}>{vm.status}</span>
                <span className="source-meta">OS: {vm.os}</span>
              </div>
              <div className="source-specs-row">
                <span className="spec-item"><Cpu size={13} /> {vm.vCpu} vCPU</span>
                <span className="spec-dot">•</span>
                <span className="spec-item"><Database size={13} /> {vm.memoryGb} GB RAM</span>
                <span className="spec-dot">•</span>
                <span className="spec-item"><HardDrive size={13} /> 디스크 {vm.disks?.length || 1}개 ({totalDiskSize || 40} GiB)</span>
                <span className="spec-dot">•</span>
                <span className="spec-item">네임스페이스: <code>{vm.namespace || 'default'}</code></span>
              </div>
            </div>

            {/* 2. Destination Specs Form */}
            <div className="form-grid-2col">
              <div className="form-group">
                <label className="form-label">
                  새 가상머신 이름 (Target VM Name) <span className="req">*</span>
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: ent-web-prd-01-clone"
                  required 
                  disabled={submitting}
                />
                <span className="form-hint">영문 소문자, 숫자, 하이픈(-)만 사용 가능</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  대상 네임스페이스 (Target Namespace) <span className="req">*</span>
                </label>
                <select 
                  className="form-select"
                  value={targetNamespace}
                  onChange={(e) => setTargetNamespace(e.target.value)}
                  disabled={submitting}
                >
                  <option value={vm.namespace}>{vm.namespace} (원본과 동일)</option>
                  {(namespaces || [])
                    .filter(n => !n.isSystem && n.name !== vm.namespace)
                    .map(n => (
                      <option key={n.name} value={n.name}>
                        {n.name} {n.displayName && n.displayName !== n.name ? `(${n.displayName})` : ''}
                      </option>
                    ))}
                  {!((namespaces || []).some(n => n.name === 'default')) && vm.namespace !== 'default' && (
                    <option value="default">default</option>
                  )}
                </select>
                <span className="form-hint">배치할 OpenShift 프로젝트 네임스페이스</span>
              </div>
            </div>

            {/* 3. Clone Type Selection (Full vs Linked) */}
            <div className="form-group">
              <label className="form-label">복제 방식 선택 (Clone Method)</label>
              
              <div className="clone-type-selector">
                {/* Full Clone */}
                <div 
                  className={`clone-type-card ${cloneType === 'full' ? 'selected' : ''}`}
                  onClick={() => setCloneType('full')}
                >
                  <div className="type-header">
                    <div className="type-title">
                      <Layers size={16} className="type-icon" />
                      <strong>Full Clone (완전 독립 복제)</strong>
                    </div>
                    <span className="type-badge recommended">강력 권장</span>
                  </div>
                  <p className="type-desc">
                    원본 VM의 모든 디스크(PVC)를 물리적으로 완전 복제합니다. 
                    복제 완료 후 <strong>원본 가상머신이 수정되거나 삭제되어도 완벽하게 독립적으로 동작</strong>하여 운영 환경에 가장 안전합니다.
                  </p>
                </div>

                {/* Linked Clone */}
                <div 
                  className={`clone-type-card ${cloneType === 'linked' ? 'selected' : ''}`}
                  onClick={() => setCloneType('linked')}
                >
                  <div className="type-header">
                    <div className="type-title">
                      <Zap size={16} className="type-icon" />
                      <strong>Linked Clone (스냅샷 기반 고속 복제)</strong>
                    </div>
                    <span className="type-badge fast">초고속 프로비저닝</span>
                  </div>
                  <p className="type-desc">
                    원본 스토리지 볼륨의 CSI 스냅샷을 참조하여 <strong>5초 이내에 초고속으로 복제</strong>합니다. 
                    스토리지 용량을 최대 80% 절감할 수 있어 테스트 및 임시 검증 환경에 최적화되어 있습니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Target StorageClass */}
            <div className="form-group">
              <label className="form-label">스토리지 클래스 (StorageClass)</label>
              <select 
                className="form-select"
                value={storageClass}
                onChange={(e) => setStorageClass(e.target.value)}
                disabled={submitting}
              >
                {(inventory?.datastores && inventory.datastores.length > 0) ? (
                  inventory.datastores.map(ds => {
                    const isCeph = ds.name?.toLowerCase().includes('ceph') || ds.name?.toLowerCase().includes('rbd') || ds.name?.toLowerCase().includes('ocs');
                    const isDsRwx = ds.liveMigrationReady || (ds.rwxSupported && !ds.name?.toLowerCase().includes('thin'));
                    return (
                      <option key={ds.id} value={ds.storageClass || ds.name}>
                        {ds.name} {isCeph ? '⭐ [ODF Ceph RBD] (Live Migration & 스냅샷 최적화)' : (isDsRwx ? '✅ (Live Migration: RWX)' : '⚠️ (RWO: Cold Only)')}
                      </option>
                    );
                  })
                ) : (
                  <>
                    <option value="ocs-storagecluster-ceph-rbd">ocs-storagecluster-ceph-rbd ⭐ (ODF Ceph RBD / Live Migration)</option>
                    <option value="thin-csi">thin-csi ⚠️ (VMware CSI 기반 동적 씬 프로비저닝)</option>
                    <option value="nfs-rwx-storage">nfs-rwx-storage ✅ (공유 파일시스템 NFS ReadWriteMany)</option>
                  </>
                )}
              </select>
            </div>

            {/* 5. Additional Post-Clone Options */}
            <div className="clone-options-panel">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={autoStart} 
                  onChange={(e) => setAutoStart(e.target.checked)}
                  disabled={submitting}
                />
                <div className="checkbox-text">
                  <span className="opt-title">복제 완료 즉시 전원 켜기 (Power on VM after creation)</span>
                  <span className="opt-desc">복제가 성공하는 즉시 자동으로 가상머신 부팅을 시작합니다.</span>
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
              onClick={() => closeModal('clone')} 
              disabled={submitting}
            >
              취소
            </button>
            <button 
              type="submit" 
              className="vsphere-btn primary-btn" 
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="spin-icon" />
                  <span>복제 요청 중...</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>가상머신 복제 시작</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
