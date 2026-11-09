import React, { useState } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { createNamespace } from '../../utils/api';
import { FolderPlus, X, AlertCircle, CheckCircle2, Loader2, Layers } from 'lucide-react';

export default function CreateNamespaceModal() {
  const { modals, closeModal, setSelectedNamespace, showToast, addTask, updateTask } = useCluster();

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!modals.createNamespace) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!cleanName) {
      setErrorMsg('유효한 프로젝트 이름을 영문 소문자, 숫자, 하이픈(-) 조합으로 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const taskId = addTask(`OpenShift 프로젝트 생성`, cleanName);

      const res = await createNamespace({
        name: cleanName,
        displayName: displayName.trim() || cleanName,
        description: description.trim()
      });

      if (res.success) {
        updateTask(taskId, { progress: 100, status: 'Completed' });
        showToast(`OpenShift 프로젝트 '${cleanName}'이(가) 생성되었습니다!`, 'success');
        setSelectedNamespace(cleanName);
        closeModal('createNamespace');
        setName('');
        setDisplayName('');
        setDescription('');
      } else {
        updateTask(taskId, { progress: 100, status: 'Failed', error: res.error || '생성 실패' });
        setErrorMsg(res.error || '프로젝트 생성에 실패했습니다.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop active">
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderPlus size={20} color="#0091da" />
            <span className="modal-title">새 OpenShift 프로젝트 (네임스페이스) 생성</span>
          </div>
          {!submitting && (
            <button className="modal-close-btn" onClick={() => closeModal('createNamespace')}>
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label">
              프로젝트 이름 (Project / Namespace Name) <span className="req" style={{ color: '#ef4444' }}>*</span>
            </label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="예: prd-workloads, team-alpha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required 
              disabled={submitting}
              autoFocus
            />
            <span className="form-hint" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              OpenShift 규격: 영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다.
            </span>
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label">표시 이름 (Display Name)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="예: 운영 1팀 가상화 워크로드"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
            />
            <span className="form-hint" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              콘솔 및 포털에 한글/친화적으로 표시될 이름 (선택 사항)
            </span>
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label">설명 (Description)</label>
            <textarea 
              className="form-input" 
              rows={3}
              placeholder="프로젝트 용도 및 담당 부서를 기록합니다."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              style={{ resize: 'vertical' }}
            />
          </div>

          {errorMsg && (
            <div className="error-alert" style={{ marginTop: '16px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button 
              type="button" 
              className="modal-btn-secondary" 
              onClick={() => closeModal('createNamespace')}
              disabled={submitting}
            >
              취소
            </button>
            <button 
              type="submit" 
              className="modal-btn-primary"
              disabled={submitting || !name.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="spinning" />
                  <span>OpenShift API 반영 중...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>프로젝트 생성</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
