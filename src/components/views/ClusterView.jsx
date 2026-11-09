import React, { useState } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { Boxes, Server, Monitor, Activity, ShieldAlert, Cpu, Database } from 'lucide-react';

export default function ClusterView() {
  const { inventory, selectEntity, selectedNamespace } = useCluster();
  const cluster = inventory?.cluster || {};
  const nodes = inventory?.nodes || [];
  const allVms = inventory?.vms || [];
  const vms = selectedNamespace === 'all' 
    ? allVms 
    : allVms.filter(v => (v.namespace || 'default') === selectedNamespace);
  const events = inventory?.events || [];

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'events'

  // Calculate totals
  const totalCpu = nodes.reduce((sum, n) => sum + (n.cpuCores || 16), 0) || 48;
  const usedCpuPct = Math.round(nodes.reduce((sum, n) => sum + (n.cpuUsedPct || 20), 0) / (nodes.length || 1));
  const totalMem = nodes.reduce((sum, n) => sum + (n.memoryGb || 64), 0) || 192;
  const usedMemGb = nodes.reduce((sum, n) => sum + (n.memoryUsedGb || 32), 0) || 88;
  const memUsedPct = Math.round((usedMemGb / totalMem) * 100);

  return (
    <div className="view-container">
      {/* Cluster Header */}
      <div className="view-header">
        <div className="view-header-title-wrap">
          <Boxes size={24} color="#0091da" />
          <div>
            <h1 className="view-title">{cluster.name || 'rhov-prod-cluster'}</h1>
            <div className="view-subtitle">{cluster.type || 'OpenShift Compact 3-Node'} • {cluster.ocpVersion}</div>
          </div>
        </div>
        <div className="header-tabs">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            클러스터 요약 & 호스트
          </button>
          <button 
            className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            <Activity size={13} style={{ marginRight: 5 }} />
            통합 이벤트 로그 ({events.length})
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Cluster Resource Gauges */}
          <div className="summary-cards-grid">
            <div className="summary-card">
              <div className="card-header">
                <span className="card-title">클러스터 vCPU 용량</span>
                <Cpu size={18} color="#0091da" />
              </div>
              <div className="card-value">{usedCpuPct}% 사용 중</div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${usedCpuPct}%` }} />
              </div>
              <div className="card-sub">{totalCpu} Cores 총 클러스터 연산 능력</div>
            </div>

            <div className="summary-card">
              <div className="card-header">
                <span className="card-title">클러스터 메모리 (RAM)</span>
                <Database size={18} color="#10b981" />
              </div>
              <div className="card-value">{usedMemGb} GB / {totalMem} GB</div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill green" style={{ width: `${memUsedPct}%` }} />
              </div>
              <div className="card-sub">{memUsedPct}% 메모리 할당됨 (KVM Ballooning 적용)</div>
            </div>

            <div className="summary-card">
              <div className="card-header">
                <span className="card-title">호스트 노드 현황</span>
                <Server size={18} color="#6366f1" />
              </div>
              <div className="card-value">{nodes.length}대 가동 중</div>
              <div className="card-sub">Control Plane + Worker 겸용 (Nested VT-x)</div>
            </div>

            <div className="summary-card">
              <div className="card-header">
                <span className="card-title">가상머신 인스턴스</span>
                <Monitor size={18} color="#f59e0b" />
              </div>
              <div className="card-value">{vms.length}대 구성됨</div>
              <div className="card-sub">실행 중: {vms.filter(v => v.status === 'Running').length}대</div>
            </div>
          </div>

          {/* Hosts (Nodes) List Table */}
          <div className="content-panel" style={{ marginTop: '20px' }}>
            <div className="panel-header">
              <span className="panel-title">클러스터 소속 호스트 노드 ({nodes.length})</span>
            </div>
            <table className="vsphere-table">
              <thead>
                <tr>
                  <th>상태</th>
                  <th>호스트 노드 이름</th>
                  <th>역할</th>
                  <th>내부 IP</th>
                  <th>CPU 사용률</th>
                  <th>메모리 사용률</th>
                  <th>호스팅 VM 수</th>
                  <th>하이퍼바이저</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map(node => (
                  <tr 
                    key={node.id} 
                    className="clickable-row"
                    onClick={() => selectEntity('node', node.id)}
                  >
                    <td><span className={`status-indicator-dot ${node.status === 'Ready' ? 'online' : 'offline'}`} /></td>
                    <td><strong>{node.name.split('.')[0]}</strong></td>
                    <td>{node.role}</td>
                    <td><code>{node.ip}</code></td>
                    <td>{node.cpuUsedPct || 15}% ({node.cpuCores} Cores)</td>
                    <td>{node.memoryUsedGb || 32} GB / {node.memoryGb || 64} GB</td>
                    <td><span className="badge-pill blue">{vms.filter(v => v.node === node.name).length} VMs</span></td>
                    <td>{node.kvmAccel || 'Nested VT-x Active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Cluster Integrated Events View */
        <div className="content-panel">
          <div className="panel-header">
            <span className="panel-title">전체 클러스터 통합 이벤트 (Cluster-wide Integrated Events)</span>
            <span className="badge-pill blue">{events.length}개 이벤트</span>
          </div>
          <table className="vsphere-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>시간</th>
                <th style={{ width: '90px' }}>유형</th>
                <th style={{ width: '160px' }}>관련 대상 (Target)</th>
                <th>메시지 내용</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt, idx) => (
                <tr key={idx}>
                  <td><code>{evt.time}</code></td>
                  <td>
                    <span className={`badge-pill ${evt.type === 'Warning' ? 'orange' : 'green'}`}>
                      {evt.type}
                    </span>
                  </td>
                  <td><strong>{evt.object}</strong></td>
                  <td>{evt.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
