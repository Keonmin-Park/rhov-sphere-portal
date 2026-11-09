import React, { useState } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { createVm } from '../../utils/api';
import { PlusCircle, X, AlertCircle } from 'lucide-react';

export default function CreateVmModal() {
  const { modals, closeModal, inventory, loadInventory, showToast, namespaces, selectedNamespace } = useCluster();

  const getPreferredStorageClass = () => {
    const list = inventory?.datastores || [];
    const preferred = list.find(d => d.isDefaultVirt) ||
                      list.find(d => d.liveMigrationReady && (d.name?.includes('ceph') || d.name?.includes('rbd') || d.name?.includes('ocs'))) ||
                      list.find(d => d.liveMigrationReady) ||
                      list[0];
    return preferred?.storageClass || preferred?.name || 'ocs-storagecluster-ceph-rbd';
  };

  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState(() => selectedNamespace !== 'all' ? selectedNamespace : 'default');
  const [osImage, setOsImage] = useState('rhel9');
  const [vCpu, setVCpu] = useState(2);
  const [memoryGb, setMemoryGb] = useState(4);
  const [diskSizeGb, setDiskSizeGb] = useState(30);
  const [storageClass, setStorageClass] = useState(() => getPreferredStorageClass() || 'ocs-storagecluster-ceph-rbd');
  const [networkName, setNetworkName] = useState(() => inventory?.networks?.[0]?.name || 'ovn-kubernetes');
  const [autoStart, setAutoStart] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sync namespace with selectedNamespace when modal opens
  React.useEffect(() => {
    if (modals.createVm) {
      setNamespace(selectedNamespace !== 'all' ? selectedNamespace : 'default');
      setStorageClass(getPreferredStorageClass());
      if (inventory?.networks?.length > 0 && !networkName) {
        setNetworkName(inventory.networks[0].name);
      }
    }
  }, [modals.createVm, selectedNamespace, inventory]);

  if (!modals.createVm) return null;

  // Workload namespaces for dropdown
  const workloadNsList = (namespaces || []).filter(n => !n.isSystem);
  if (!workloadNsList.find(n => n.name === 'default')) {
    workloadNsList.unshift({ name: 'default', displayName: 'default' });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('가상머신 이름을 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await createVm({
        name: name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        namespace: namespace || 'default',
        osImage,
        vCpu: parseInt(vCpu),
        memoryGb: parseInt(memoryGb),
        diskSizeGb: parseInt(diskSizeGb),
        storageClass,
        network: networkName,
        autoStart
      });

      if (res.success) {
        showToast(`가상머신 '${res.name}' 생성이 요청되었습니다! (OpenShift 반영 중)`, 'success');
        closeModal('createVm');
        setTimeout(() => loadInventory(false), 2000);
      } else {
        setErrorMsg(res.error || 'VM 생성 실패');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop active">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={20} color="#0091da" />
            <span className="modal-title">새 가상머신 생성 (New Virtual Machine)</span>
          </div>
          <button className="modal-close-btn" onClick={() => closeModal('createVm')}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>가상머신 이름 (Name)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="예: web-app-prod-01"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required 
            />
          </div>

          <div className="form-group">
            <label>배치할 프로젝트 (Project / Namespace)</label>
            <select 
              className="form-select" 
              value={namespace} 
              onChange={(e) => setNamespace(e.target.value)}
              disabled={submitting}
            >
              {workloadNsList.map(ns => (
                <option key={ns.name} value={ns.name}>
                  {ns.name} {ns.displayName && ns.displayName !== ns.name ? `(${ns.displayName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>운영체제 템플릿 (OS Image)</label>
            <select className="form-select" value={osImage} onChange={(e) => setOsImage(e.target.value)}>
              <option value="rhel9">Red Hat Enterprise Linux 9 (RHEL 9.4)</option>
              <option value="rocky9">Rocky Linux 9.4</option>
              <option value="rhel8">Red Hat Enterprise Linux 8.10</option>
              <option value="win11">Microsoft Windows 11 Enterprise</option>
            </select>
          </div>

          <div className="form-row-grid">
            <div className="form-group">
              <label>vCPU 코어 (Cores)</label>
              <input 
                type="number" 
                className="form-input" 
                value={vCpu} 
                min="1" 
                max="32" 
                onChange={(e) => setVCpu(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label>메모리 (GiB)</label>
              <input 
                type="number" 
                className="form-input" 
                value={memoryGb} 
                min="1" 
                max="128" 
                onChange={(e) => setMemoryGb(e.target.value)} 
              />
            </div>
          </div>

          <div className="form-row-grid">
            <div className="form-group">
              <label>OS 루트 디스크 크기 (GiB)</label>
              <input 
                type="number" 
                className="form-input" 
                value={diskSizeGb} 
                min="10" 
                max="500" 
                onChange={(e) => setDiskSizeGb(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label>스토리지 클래스 (StorageClass / Datastore)</label>
              <select className="form-select" value={storageClass} onChange={(e) => setStorageClass(e.target.value)}>
                {(inventory?.datastores && inventory.datastores.length > 0) ? (
                  inventory.datastores.map(ds => {
                    const isCeph = ds.name?.toLowerCase().includes('ceph') || ds.name?.toLowerCase().includes('rbd') || ds.name?.toLowerCase().includes('ocs');
                    const isDsRwx = ds.liveMigrationReady || (ds.rwxSupported && !ds.name?.toLowerCase().includes('thin') && !ds.storageClass?.toLowerCase().includes('thin'));
                    const isDefault = ds.isDefaultVirt || ds.isDefault;
                    return (
                      <option key={ds.id} value={ds.storageClass || ds.name}>
                        {ds.name} {isCeph ? '⭐ [ODF Ceph RBD] (Live Migration & 스냅샷 최적화)' : (isDsRwx ? '✅ (Live Migration: RWX)' : '⚠️ (RWO: Cold Only)')} {isDefault ? '(기본)' : ''}
                      </option>
                    );
                  })
                ) : (
                  <>
                    <option value="ocs-storagecluster-ceph-rbd">ocs-storagecluster-ceph-rbd ⭐ (ODF Ceph RBD / Live Migration)</option>
                    <option value="thin-csi">thin-csi ⚠️ (vSphere CSI / RWO)</option>
                    <option value="nfs-rwx">nfs-rwx ✅ (공유 NFS / RWX)</option>
                  </>
                )}
              </select>
              {(() => {
                const scLower = (storageClass || '').toLowerCase();
                const curDs = inventory?.datastores?.find(d => (d.storageClass || d.name) === storageClass);
                const isCeph = scLower.includes('ceph') || scLower.includes('rbd') || scLower.includes('ocs') || curDs?.name?.toLowerCase().includes('ceph');
                const isThin = scLower.includes('thin') || curDs?.provisioning?.includes('Thin') || (curDs && !curDs.rwxSupported);
                const isNfs = scLower.includes('nfs');

                if (isCeph) {
                  return (
                    <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', lineHeight: 1.4 }}>
                      ⭐ <strong>ODF Ceph RBD 권장:</strong> 분산 고속 블록 스토리지로 프로비저닝되어 <strong>무중단 실시간 마이그레이션(vMotion)</strong> 및 <strong>온라인 초고속 스냅샷</strong>이 완벽 지원됩니다.
                    </div>
                  );
                }
                if (isThin) {
                  return (
                    <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px', lineHeight: 1.4 }}>
                      ⚠️ <strong>thin-csi 주의:</strong> vSphere RWO 단일 노드 전용 블록 디스크로 프로비저닝되어 차후 무중단 Live Migration(vMotion)이 지원되지 않습니다. (Cold Migration 전용)
                    </div>
                  );
                }
                if (isNfs) {
                  return (
                    <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', lineHeight: 1.4 }}>
                      ✅ <strong>nfs-rwx:</strong> 공유 스토리지(RWX)로 프로비저닝되어 노드 간 실시간 무중단 vMotion(Live Migration)이 지원됩니다.
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          <div className="form-group">
            <label>가상 네트워크 인터페이스 (Network / PortGroup)</label>
            <select className="form-select" value={networkName} onChange={(e) => setNetworkName(e.target.value)}>
              {(inventory?.networks && inventory.networks.length > 0) ? (
                inventory.networks.map(net => (
                  <option key={net.id} value={net.name}>
                    {net.name} [{net.type}] {net.vlan ? `(VLAN: ${net.vlan})` : ''}
                  </option>
                ))
              ) : (
                <>
                  <option value="ovn-kubernetes">ovn-kubernetes [Cluster Default Pod CNI]</option>
                  <option value="corp-vlan200-bridge">corp-vlan200-bridge [Multus L2 사내망 브릿지]</option>
                </>
              )}
            </select>
          </div>

          <div className="form-group checkbox-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={autoStart} 
                onChange={(e) => setAutoStart(e.target.checked)} 
              />
              <span>생성 후 가상머신 자동 시작 (Power On Immediately)</span>
            </label>
          </div>

          {errorMsg && (
            <div className="status-banner error">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={() => closeModal('createVm')} disabled={submitting}>
              취소
            </button>
            <button type="submit" className="header-btn-primary" disabled={submitting}>
              <PlusCircle size={14} />
              <span>{submitting ? '생성 요청 중...' : '가상머신 생성'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
