import React from 'react';
import { useCluster } from '../../../context/ClusterContext';
import { Activity, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function VmEventsTab() {
  const { selectedVmDetail, inventory } = useCluster();
  const vm = selectedVmDetail;
  const allEvents = inventory?.events || [];

  if (!vm) return null;

  // Filter events ONLY for this specific VM
  const vmEvents = allEvents.filter(e => 
    e.object === vm.name || 
    (e.message && e.message.includes(vm.name))
  );

  return (
    <div className="vm-events-tab-content">
      <div className="content-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="#0091da" />
            <span className="panel-title">'{vm.name}' 전용 이벤트 기록</span>
            <span className="badge-pill blue">{vmEvents.length}개 이벤트 필터됨</span>
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            * 전체 통합 이벤트는 클러스터 화면에서 확인할 수 있습니다.
          </span>
        </div>

        {vmEvents.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-sub)' }}>
            <ShieldCheck size={28} color="#10b981" style={{ marginBottom: 8 }} />
            <div>가상머신 <strong>'{vm.name}'</strong>에 대한 최근 경고 또는 오류 이벤트가 없습니다. 시스템이 정상 동작 중입니다.</div>
          </div>
        ) : (
          <table className="vsphere-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>시간</th>
                <th style={{ width: '90px' }}>유형</th>
                <th style={{ width: '140px' }}>대상 (Object)</th>
                <th>메시지 내용 (KubeVirt Event)</th>
              </tr>
            </thead>
            <tbody>
              {vmEvents.map((evt, idx) => (
                <tr key={idx}>
                  <td><code>{evt.time}</code></td>
                  <td>
                    <span className={`badge-pill ${evt.type === 'Warning' ? 'orange' : 'green'}`}>
                      {evt.type === 'Warning' ? <AlertTriangle size={11} style={{ marginRight: 3 }} /> : null}
                      {evt.type}
                    </span>
                  </td>
                  <td><strong>{evt.object}</strong></td>
                  <td>{evt.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
