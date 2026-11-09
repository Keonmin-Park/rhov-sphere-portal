import React from 'react';
import { useCluster } from '../../context/ClusterContext';
import { Building2, Boxes, Server, Monitor, ShieldCheck, HardDrive } from 'lucide-react';

export default function DatacenterView() {
  const { inventory, selectEntity, selectedNamespace } = useCluster();
  const dc = inventory?.datacenter || {};
  const cluster = inventory?.cluster || {};
  const nodes = inventory?.nodes || [];
  const allVms = inventory?.vms || [];
  const vms = selectedNamespace === 'all' 
    ? allVms 
    : allVms.filter(v => (v.namespace || 'default') === selectedNamespace);

  const runningVms = vms.filter(v => v.status === 'Running').length;
  const stoppedVms = vms.length - runningVms;

  return (
    <div className="view-container">
      {/* View Header */}
      <div className="view-header">
        <div className="view-header-title-wrap">
          <Building2 size={24} color="#0091da" />
          <div>
            <h1 className="view-title">{dc.name || 'Enterprise-Seoul-DC'}</h1>
            <div className="view-subtitle">{dc.location || 'Seoul IDC 2F, RHOV Zone'} • {dc.vCenterCompatibility}</div>
          </div>
        </div>
        <div className="status-pill-badge online">
          <ShieldCheck size={14} />
          <span>Datacenter 정상 (Healthy)</span>
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div className="summary-cards-grid">
        <div className="summary-card" onClick={() => selectEntity('cluster', cluster.id || 'cluster-01')}>
          <div className="card-header">
            <span className="card-title">클러스터 (Clusters)</span>
            <Boxes size={18} color="#0091da" />
          </div>
          <div className="card-value">1개 클러스터</div>
          <div className="card-sub">{cluster.name || 'rhov-prod-cluster'} (Compact 3-Node)</div>
        </div>

        <div className="summary-card">
          <div className="card-header">
            <span className="card-title">호스트 노드 (Nodes)</span>
            <Server size={18} color="#10b981" />
          </div>
          <div className="card-value">{nodes.length}대 가동 중</div>
          <div className="card-sub">모두 Ready 상태 (Nested KVM 활성)</div>
        </div>

        <div className="summary-card">
          <div className="card-header">
            <span className="card-title">가상머신 (VMs)</span>
            <Monitor size={18} color="#6366f1" />
          </div>
          <div className="card-value">{vms.length}대 총 VM</div>
          <div className="card-sub">실행 중: <strong style={{ color: '#10b981' }}>{runningVms}대</strong> | 정지: {stoppedVms}대</div>
        </div>

        <div className="summary-card">
          <div className="card-header">
            <span className="card-title">데이터스토어 스토리지</span>
            <HardDrive size={18} color="#f59e0b" />
          </div>
          <div className="card-value">{cluster.usedStorageTb || 2.2} TB / {cluster.totalStorageTb || 6.0} TB</div>
          <div className="card-sub">thin-csi (vSphere) & nfs-rwx 공유 풀</div>
        </div>
      </div>

      {/* Clusters Table */}
      <div className="content-panel" style={{ marginTop: '20px' }}>
        <div className="panel-header">
          <span className="panel-title">소속 클러스터 목록</span>
        </div>
        <table className="vsphere-table">
          <thead>
            <tr>
              <th>클러스터 이름</th>
              <th>유형</th>
              <th>OpenShift 버전</th>
              <th>노드 수</th>
              <th>vCPU 사용률</th>
              <th>메모리 사용률</th>
              <th>고가용성(HA)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="clickable-row" onClick={() => selectEntity('cluster', cluster.id || 'cluster-01')}>
              <td><strong>{cluster.name || 'rhov-prod-cluster'}</strong></td>
              <td>{cluster.type || 'OpenShift Compact 3-Node'}</td>
              <td>{cluster.ocpVersion || 'OpenShift 4.22'}</td>
              <td>{nodes.length} 노드</td>
              <td>{Math.round(((cluster.usedCpuCores || 18) / (cluster.totalCpuCores || 48)) * 100)}% ({cluster.usedCpuCores || 18}/{cluster.totalCpuCores || 48} Cores)</td>
              <td>{Math.round(((cluster.usedMemoryGb || 88) / (cluster.totalMemoryGb || 192)) * 100)}% ({cluster.usedMemoryGb || 88}/{cluster.totalMemoryGb || 192} GB)</td>
              <td><span className="badge-pill green">활성화 (Live Migration)</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
