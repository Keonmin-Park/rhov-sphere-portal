import React, { useState } from 'react';

import { useCluster } from '../../context/ClusterContext';
import { connectCluster } from '../../utils/api';
import { Radio, X, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ConnectModal() {
  const { modals, closeModal, inventory, loadInventory, showToast } = useCluster();

  const [apiUrl, setApiUrl] = useState(() => inventory?.cluster?.apiUrl || '');
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connectResult, setConnectResult] = useState(null);

  if (!modals.connect) return null;

  const handleTestConnect = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setConnectResult({ type: 'loading', text: 'OpenShift API Server 연결 테스트 중...' });

      const res = await connectCluster(apiUrl.trim(), token.trim());
      if (res.success) {
        setConnectResult({
          type: 'success',
          text: res.message,
          info: res.clusterInfo
        });
        showToast('OpenShift 클러스터 연결 성공!', 'success');
        setTimeout(() => {
          loadInventory(true);
        }, 1500);
      } else {
        setConnectResult({ type: 'error', text: res.message || '연결 실패' });
      }
    } catch (err) {
      setConnectResult({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop active">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={20} color="#0091da" />
            <span className="modal-title">OpenShift 클러스터 연결 설정</span>
          </div>
          <button className="modal-close-btn" onClick={() => closeModal('connect')}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleTestConnect} className="modal-body">
          <div className="form-group">
            <label>OpenShift API Server URL</label>
            <input
              type="text"
              className="form-input"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="예: https://api.ocp.domain:6443 또는 https://kubernetes.default.svc:443"
              required
            />
          </div>

          <div className="form-group">
            <label>ServiceAccount Bearer Token (KubeVirt Operator RBAC)</label>
            <textarea
              className="form-textarea"
              rows="4"
              placeholder="생략 시 기존 활성 토큰 또는 In-Cluster SA 토큰을 유지합니다..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              * Pod 구동 시 ServiceAccount(/var/run/secrets/...)가 자동 주입되며, 수동 주입 시 타 클러스터의 API IP와 Token을 동적으로 주입하여 동기화할 수 있습니다.
            </span>
          </div>

          {connectResult && (
            <div className={`status-banner ${connectResult.type}`}>
              {connectResult.type === 'loading' && <span className="spinner-inline" />}
              {connectResult.type === 'success' && <CheckCircle2 size={16} color="#10b981" />}
              {connectResult.type === 'error' && <AlertCircle size={16} color="#ef4444" />}
              <div>
                <div>{connectResult.text}</div>
                {connectResult.info && (
                  <div style={{ fontSize: '11.5px', marginTop: '4px', opacity: 0.85 }}>
                    Kubernetes: {connectResult.info.serverVersion} • OpenShift: {connectResult.info.openShiftVersion} • 노드 {connectResult.info.detectedNodes}대
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={() => closeModal('connect')} disabled={submitting}>
              닫기
            </button>
            <button type="submit" className="header-btn-primary" disabled={submitting}>
              <Radio size={14} />
              <span>{submitting ? '연결 확인 중...' : '연결 테스트 & 동기화'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
