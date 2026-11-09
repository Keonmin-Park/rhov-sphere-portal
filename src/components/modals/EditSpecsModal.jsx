import React, { useState, useEffect } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { updateHardware } from '../../utils/api';
import { 
  Sliders, 
  HardDrive, 
  Network, 
  Zap, 
  Plus, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Cpu,
  Database,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';

export default function EditSpecsModal() {
  const { 
    modals, 
    closeModal, 
    modalTargetVm, 
    inventory, 
    loadInventory, 
    addTask, 
    updateTask, 
    showToast 
  } = useCluster();

  const vm = modalTargetVm;

  const [vCpu, setVCpu] = useState(2);
  const [memoryGb, setMemoryGb] = useState(4);
  const [disks, setDisks] = useState([]);
  const [nics, setNics] = useState([]);

  const getPreferredStorageClass = () => {
    const list = inventory?.datastores || [];
    const preferred = list.find(d => d.isDefaultVirt) ||
                      list.find(d => d.liveMigrationReady && (d.name?.includes('ceph') || d.name?.includes('rbd') || d.name?.includes('ocs'))) ||
                      list.find(d => d.liveMigrationReady) ||
                      list[0];
    return preferred?.storageClass || preferred?.name || vm?.disks?.[0]?.sc || 'ocs-storagecluster-ceph-rbd';
  };

  // New disk input fields
  const [newDiskName, setNewDiskName] = useState('');
  const [newDiskSize, setNewDiskSize] = useState(50);
  const [newDiskSc, setNewDiskSc] = useState(() => getPreferredStorageClass() || 'ocs-storagecluster-ceph-rbd');

  // New nic input fields
  const [newNicNet, setNewNicNet] = useState('default/physnet (Multus L2)');

  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (vm) {
      setVCpu(vm.vCpu || 2);
      setMemoryGb(vm.memoryGb || 4);
      setNewDiskSc(getPreferredStorageClass());
      setDisks((vm.disks || []).map((d, i) => ({
        name: d.name || `disk-0${i + 1}`,
        pvc: d.pvc,
        sizeGb: parseInt(d.sizeGb) || 30,
        sc: d.sc || getPreferredStorageClass(),
        isBoot: i === 0 || d.name?.includes('root') || d.name?.includes('vol-0')
      })));
      setNics((vm.nics || []).map((n, i) => ({
        name: n.name || `vnic${i}`,
        network: n.network || 'default/physnet (Multus L2)',
        model: n.model || 'virtio'
      })));
      setStatusMsg(null);
    }
  }, [vm, modals.editSpecs]);

  if (!modals.editSpecs || !vm) return null;

  // Comparison Math for Before / After Preview (#60)
  const currentVCpu = vm.vCpu || 2;
  const currentMem = vm.memoryGb || 4;
  const targetVCpu = parseInt(vCpu) || currentVCpu;
  const targetMem = parseInt(memoryGb) || currentMem;

  const vCpuDiff = targetVCpu - currentVCpu;
  const memDiff = targetMem - currentMem;
  const diskDiff = disks.length - (vm.disks?.length || 0);
  const hasChanges = vCpuDiff !== 0 || memDiff !== 0 || diskDiff !== 0;

  // Check Node Capacity Overcommit Warning (#43)
  const node = inventory?.nodes?.find(n => n.name === vm.node);
  const nodeMemTotal = node?.memoryGb || 64;
  const isMemOverlimit = targetMem > (nodeMemTotal * 0.75);

  const handleDiskSizeChange = (idx, val) => {
    const num = Math.max(5, parseInt(val) || 10);
    setDisks(prev => prev.map((d, i) => i === idx ? { ...d, sizeGb: num } : d));
  };

  const handleRemoveDisk = (idx) => {
    if (disks[idx]?.isBoot) {
      alert('부트(OS) 디스크는 제거할 수 없습니다.');
      return;
    }
    setDisks(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddDisk = () => {
    const rawName = newDiskName.trim() || `disk-data-0${disks.length + 1}`;
    setDisks(prev => [
      ...prev,
      {
        name: rawName,
        sizeGb: Math.max(5, parseInt(newDiskSize) || 50),
        sc: newDiskSc,
        isBoot: false
      }
    ]);
    setNewDiskName('');
    setNewDiskSize(50);
  };

  const handleRemoveNic = (idx) => {
    if (nics.length <= 1) {
      alert('가상머신에는 최소 1개의 네트워크 어댑터가 필요합니다.');
      return;
    }
    setNics(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddNic = () => {
    setNics(prev => [
      ...prev,
      {
        name: `vnic${prev.length}`,
        network: newNicNet,
        model: 'virtio'
      }
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const taskId = addTask('하드웨어 사양 동적 재구성 (Hot-plug Reconfig)', vm.name);

    try {
      setSubmitting(true);
      setStatusMsg({ type: 'loading', text: 'KubeVirt Live Hotplug API 및 OpenShift 스토리지 변경 요청 중...' });
      updateTask(taskId, { progress: 30 });

      const res = await updateHardware(vm.id, {
        vCpu: targetVCpu,
        memoryGb: targetMem,
        disks,
        nics
      });
      updateTask(taskId, { progress: 75 });

      if (res.success) {
        const isHotplug = res.hotplug && res.hotplugOperations && res.hotplugOperations.length > 0;
        const msgText = isHotplug
          ? '⚡ [무중단 Live Hotplug 완료] VM 재부팅 없이 실시간으로 가상 디스크/사양이 연결되었습니다!'
          : '✅ 하드웨어 사양이 성공적으로 업데이트되었습니다.';

        setStatusMsg({ type: 'success', text: msgText });
        showToast(msgText, 'success');

        updateTask(taskId, {
          progress: 100,
          status: 'Completed',
          error: null
        });

        setTimeout(async () => {
          await loadInventory(true);
          closeModal('editSpecs');
        }, 1200);
      } else {
        throw new Error(res.error || 'API 오류');
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: `오류 발생: ${err.message}` });
      updateTask(taskId, {
        progress: 100,
        status: 'Failed',
        error: err.message
      });
      showToast(`사양 변경 실패: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop active">
      <div className="modal-box modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={20} color="#0091da" />
            <span className="modal-title">하드웨어 사양 편집 (Edit Virtual Hardware) — {vm.name}</span>
          </div>
          <button className="modal-close-btn" onClick={() => closeModal('editSpecs')}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Before / After Comparison Preview Card (#60) */}
          <div className="reconfig-preview-card">
            <div className="preview-card-header">
              <Zap size={14} className="preview-icon" />
              <strong>하드웨어 변경 전/후 비교 프리뷰 (Reconfiguration Preview)</strong>
              {hasChanges ? (
                <span className="change-badge modified">변경 사항 있음</span>
              ) : (
                <span className="change-badge same">현재 사양 유지</span>
              )}
            </div>

            <div className="preview-metrics-grid">
              {/* vCPU */}
              <div className="preview-metric-box">
                <span className="p-label"><Cpu size={12} /> vCPU 코어</span>
                <div className="p-values">
                  <span className="val-before">{currentVCpu} 코어</span>
                  <ArrowRight size={13} className="val-arrow" />
                  <span className="val-after">{targetVCpu} 코어</span>
                </div>
                <div className="p-diff">
                  {vCpuDiff > 0 && <span className="diff-tag up"><TrendingUp size={11} /> +{vCpuDiff} 코어 증설</span>}
                  {vCpuDiff < 0 && <span className="diff-tag down"><TrendingDown size={11} /> {vCpuDiff} 코어 축소</span>}
                  {vCpuDiff === 0 && <span className="diff-tag neutral">동일</span>}
                </div>
              </div>

              {/* Memory */}
              <div className="preview-metric-box">
                <span className="p-label"><Database size={12} /> vRAM 메모리</span>
                <div className="p-values">
                  <span className="val-before">{currentMem} GiB</span>
                  <ArrowRight size={13} className="val-arrow" />
                  <span className="val-after">{targetMem} GiB</span>
                </div>
                <div className="p-diff">
                  {memDiff > 0 && <span className="diff-tag up"><TrendingUp size={11} /> +{memDiff} GiB 증설</span>}
                  {memDiff < 0 && <span className="diff-tag down"><TrendingDown size={11} /> {memDiff} GiB 축소</span>}
                  {memDiff === 0 && <span className="diff-tag neutral">동일</span>}
                </div>
              </div>

              {/* Disks */}
              <div className="preview-metric-box">
                <span className="p-label"><HardDrive size={12} /> 연결 디스크</span>
                <div className="p-values">
                  <span className="val-before">{vm.disks?.length || 1}개</span>
                  <ArrowRight size={13} className="val-arrow" />
                  <span className="val-after">{disks.length}개</span>
                </div>
                <div className="p-diff">
                  {diskDiff > 0 && <span className="diff-tag up"><Plus size={11} /> +{diskDiff}개 핫플러그</span>}
                  {diskDiff < 0 && <span className="diff-tag down">{diskDiff}개 제거</span>}
                  {diskDiff === 0 && <span className="diff-tag neutral">동일</span>}
                </div>
              </div>
            </div>

            {/* Overcommit Alert Warning (#43) */}
            {isMemOverlimit && (
              <div className="overcommit-warning-bar">
                <AlertTriangle size={14} />
                <span>주의: 할당 메모리({targetMem} GiB)가 호스트 총 용량({nodeMemTotal} GiB)의 75%를 초과하여 경합 위험이 있습니다.</span>
              </div>
            )}
          </div>

          {/* 1. CPU & Memory Sliders */}
          <div className="spec-group-box">
            <div className="spec-group-header">
              <span>⚡ 컴퓨팅 자원 (vCPU & 메모리)</span>
            </div>
            <div className="form-row-grid">
              <div className="form-group">
                <label>vCPU 코어 수 (Cores)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={vCpu} 
                  min="1" 
                  max="64" 
                  onChange={(e) => setVCpu(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label>메모리 용량 (GiB)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={memoryGb} 
                  min="1" 
                  max="256" 
                  onChange={(e) => setMemoryGb(e.target.value)}
                  required 
                />
              </div>
            </div>
          </div>

          {/* 2. Virtual Disks Section */}
          <div className="spec-group-box">
            <div className="spec-group-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HardDrive size={16} color="#0091da" />
                <span>가상 디스크 (Virtual Disks & Hotplug PVCs)</span>
              </div>
            </div>

            <div className="spec-items-list">
              {disks.map((d, idx) => (
                <div key={idx} className="spec-item-row">
                  <div className="spec-item-info">
                    <span className="spec-disk-name">{d.name}</span>
                    {d.isBoot && <span className="spec-boot-badge">OS Boot</span>}
                    <span className="spec-disk-sc">({d.sc || 'thin-csi'})</span>
                  </div>

                  <div className="spec-item-actions">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input 
                        type="number" 
                        className="form-input-sm" 
                        value={d.sizeGb} 
                        min="5" 
                        max="2000"
                        onChange={(e) => handleDiskSizeChange(idx, e.target.value)}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>GiB</span>
                    </div>

                    <button 
                      type="button" 
                      className="btn-spec-del"
                      disabled={d.isBoot}
                      onClick={() => handleRemoveDisk(idx)}
                      title={d.isBoot ? '부트 디스크는 삭제할 수 없습니다' : '디스크 삭제'}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="spec-add-row">
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>+ 새 디스크:</span>
              <input 
                type="text" 
                placeholder="디스크 이름 (예: data-vol)"
                value={newDiskName} 
                onChange={(e) => setNewDiskName(e.target.value)}
                style={{ flex: 1, padding: '4px 8px', fontSize: '11.5px' }}
                className="form-input"
              />
              <input 
                type="number" 
                placeholder="GiB"
                value={newDiskSize} 
                min="5" 
                max="1000"
                onChange={(e) => setNewDiskSize(e.target.value)}
                style={{ width: '70px', padding: '4px 8px', fontSize: '11.5px' }}
                className="form-input"
              />
              <select 
                className="form-select"
                value={newDiskSc}
                onChange={(e) => setNewDiskSc(e.target.value)}
                style={{ width: '190px', padding: '4px 8px', fontSize: '11.5px' }}
              >
                {(inventory?.datastores && inventory.datastores.length > 0) ? (
                  inventory.datastores.map(ds => (
                    <option key={ds.id} value={ds.storageClass || ds.name}>
                      {ds.name} {ds.name?.includes('ceph') || ds.name?.includes('rbd') ? '⭐ [ODF]' : (ds.liveMigrationReady ? '✅ [RWX]' : '⚠️ [RWO]')}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="ocs-storagecluster-ceph-rbd">ocs-storagecluster-ceph-rbd ⭐ (ODF)</option>
                    <option value="thin-csi">thin-csi (무중단 Hotplug)</option>
                    <option value="nfs-rwx">nfs-rwx (공유 NFS)</option>
                  </>
                )}
              </select>
              <button 
                type="button" 
                className="header-btn-secondary" 
                onClick={handleAddDisk}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                <Plus size={13} />
                <span>추가</span>
              </button>
            </div>
          </div>

          {/* 3. Network Adapters Section */}
          <div className="spec-group-box">
            <div className="spec-group-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Network size={16} color="#10b981" />
                <span>네트워크 어댑터 (vNICs & Port Groups)</span>
              </div>
            </div>

            <div className="spec-items-list">
              {nics.map((n, idx) => (
                <div key={idx} className="spec-item-row">
                  <div className="spec-item-info">
                    <span>🌐</span>
                    <span className="spec-disk-name">{n.name}</span>
                    <span className="spec-disk-sc">({n.network})</span>
                  </div>
                  <div className="spec-item-actions">
                    <button 
                      type="button" 
                      className="btn-spec-del"
                      disabled={nics.length <= 1}
                      onClick={() => handleRemoveNic(idx)}
                      title={nics.length <= 1 ? '최소 1개의 어댑터가 필요합니다' : '어댑터 제거'}
                    >
                      제거
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="spec-add-row">
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>+ 새 어댑터:</span>
              <select 
                className="form-select"
                value={newNicNet}
                onChange={(e) => setNewNicNet(e.target.value)}
                style={{ flex: 1, padding: '4px 8px', fontSize: '11.5px' }}
              >
                <option value="default/physnet (Multus L2)">physnet (사내 L2 VLAN)</option>
                <option value="ovn-kubernetes (Default Pod)">ovn-kubernetes (기본 Pod CNI)</option>
              </select>
              <button 
                type="button" 
                className="header-btn-secondary" 
                onClick={handleAddNic}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                <Plus size={13} />
                <span>추가</span>
              </button>
            </div>
          </div>

          {/* Status Message Feedback */}
          {statusMsg && (
            <div className={`status-banner ${statusMsg.type}`}>
              {statusMsg.type === 'loading' && <span className="spinner-inline" />}
              {statusMsg.type === 'success' && <CheckCircle2 size={16} color="#10b981" />}
              {statusMsg.type === 'error' && <AlertCircle size={16} color="#ef4444" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={() => closeModal('editSpecs')} disabled={submitting}>
              취소
            </button>
            <button type="submit" className="header-btn-primary" disabled={submitting}>
              <Zap size={14} />
              <span>{submitting ? '적용 중...' : '스펙 변경 적용'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
