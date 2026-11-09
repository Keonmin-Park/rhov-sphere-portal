import React, { useState } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { deleteVm } from '../../utils/api';
import { Trash2, X, AlertTriangle, HardDrive, Loader2 } from 'lucide-react';

export default function DeleteVmModal() {
  const { modals, closeModal, modalTargetVm, loadInventory, showToast } = useCluster();
  const [deleteDisks, setDeleteDisks] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!modals.deleteVm || !modalTargetVm) return null;

  const vm = modalTargetVm;
  const disks = vm.disks || [];

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setErrorMsg(null);
      showToast(`'${vm.name}' 삭제 요청 중...`, 'warning');
      const res = await deleteVm(vm.id || vm.name, deleteDisks);
      if (res.success) {
        showToast(`가상머신 '${vm.name}'이(가) 삭제되었습니다.${deleteDisks ? ' (연결된 영구 디스크 포함)' : ''}`, 'success');
        closeModal('deleteVm');
        setTimeout(() => loadInventory(false), 1500);
      } else {
        setErrorMsg(res.error || '가상머신 삭제에 실패했습니다.');
      }
    } catch (err) {
      setErrorMsg(err.message || '가상머신 삭제 오류');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop active">
      <div className="modal-box" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={20} color="#ef4444" />
            <span className="modal-title">가상머신 영구 삭제 (Delete VirtualMachine)</span>
          </div>
          <button className="modal-close-btn" onClick={() => !deleting && closeModal('deleteVm')} disabled={deleting}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          {errorMsg && (
            <div className="modal-error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '50%', color: '#ef4444', flexShrink: 0 }}>
              <AlertTriangle size={26} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                가상머신 '{vm.name}'을(를) 삭제하시겠습니까?
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                이 작업은 OpenShift Virtualization 클러스터에서 가상머신 구성을 완전히 삭제하며, 삭제 후 되돌릴 수 없습니다.
              </div>
            </div>
          </div>

          {/* Disk Option Checkbox */}
          <div 
            style={{ 
              background: 'var(--bg-hover)', 
              padding: '14px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)', 
              marginBottom: '16px',
              cursor: 'pointer' 
            }}
            onClick={() => !deleting && setDeleteDisks(!deleteDisks)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input 
                type="checkbox" 
                checked={deleteDisks} 
                onChange={(e) => setDeleteDisks(e.target.checked)}
                disabled={deleting}
                style={{ marginTop: '3px', cursor: 'pointer' }}
                onClick={(e) => e.stopPropagation()}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  연결된 영구 데이터 디스크(PVC)도 함께 영구 삭제
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  체크 해제 시 가상머신 정의만 삭제되고 실제 스토리지 볼륨(PVC)은 클러스터에 안전하게 보존(Orphan)됩니다.
                </div>
              </div>
            </div>

            {disks.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  삭제 대상 디스크 볼륨 ({disks.length}개):
                </div>
                {disks.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: deleteDisks ? '#ef4444' : 'var(--text-muted)', marginBottom: '4px' }}>
                    <HardDrive size={13} />
                    <span>{d.name || `disk-${i}`} ({d.sizeGb || 30} GB, {d.sc || 'storage'})</span>
                    {d.pvc && <code style={{ fontSize: '11px', background: 'rgba(0,0,0,0.15)', padding: '1px 4px', borderRadius: '3px' }}>{d.pvc}</code>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button 
            type="button" 
            className="btn-cancel" 
            onClick={() => closeModal('deleteVm')} 
            disabled={deleting}
          >
            취소
          </button>
          <button 
            type="button" 
            onClick={handleDelete} 
            disabled={deleting}
            style={{ 
              background: '#ef4444', 
              color: '#ffffff', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '6px', 
              fontWeight: 600, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.7 : 1
            }}
          >
            {deleting ? <Loader2 size={15} className="spinner" /> : <Trash2 size={15} />}
            <span>{deleting ? '삭제 중...' : '가상머신 삭제'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
