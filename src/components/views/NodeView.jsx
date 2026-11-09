import React, { useState } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { toggleMaintenance } from '../../utils/api';
import { Server, Monitor, Cpu, Database, Shield, Power, Activity } from 'lucide-react';

export default function NodeView() {
  const { inventory, selectedEntity, selectEntity, loadInventory, showToast } = useCluster();
  const node = inventory?.nodes?.find(n => n.id === selectedEntity?.id) || inventory?.nodes?.[0];
  const vmsOnNode = inventory?.vms?.filter(v => v.node === node?.name) || [];

  const [toggling, setToggling] = useState(false);

  if (!node) {
    return <div className="view-container">노드 정보를 찾을 수 없습니다.</div>;
  }

  const handleMaintenanceToggle = async () => {
    try {
      setToggling(true);
      const res = await toggleMaintenance(node.name);
      if (res.maintenanceMode) {
        showToast(`'${node.name.split('.')[0]}' 호스트가 유지관리 모드로 전환되었습니다. 소속 VM 라이브 마이그레이션이 진행됩니다.`, 'warning');
      } else {
        showToast(`'${node.name.split('.')[0]}' 호스트가 정상 운영 모드로 복귀했습니다.`, 'success');
      }
      await loadInventory(true);
    } catch (e) {
      showToast(`유지관리 모드 전환 실패: ${e.message}`, 'error');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="view-container">
      {/* Node Header */}
      <div className="view-header">
        <div className="view-header-title-wrap">
          <Server size={24} color="#0091da" />
          <div>
            <h1 className="view-title">{node.name.split('.')[0]}</h1>
            <div className="view-subtitle">{node.role} • IP: <code>{node.ip}</code> • ESXi Host: {node.esxiHost || 'esxi-node01.example.local'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span className={`status-pill-badge ${node.maintenanceMode ? 'warning' : 'online'}`}>
            <Shield size={14} />
            <span>{node.maintenanceMode ? '유지관리 모드 (Maintenance)' : '정상 운영 중 (Ready)'}</span>
          </span>
          <button 
            className="header-btn-secondary"
            onClick={handleMaintenanceToggle}
            disabled={toggling}
          >
            <Power size={14} />
            <span>{node.maintenanceMode ? '유지관리 종료' : '유지관리 모드 전환'}</span>
          </button>
        </div>
      </div>

      {/* Node Spec Summary Cards */}
      <div className="summary-cards-grid">
        <div className="summary-card">
          <div className="card-header">
            <span className="card-title">프로세서 연산량</span>
            <Cpu size={18} color="#0091da" />
          </div>
          <div className="card-value">{node.cpuGhzUsed || 2.8} GHz / {node.cpuGhzTotal || 35.2} GHz</div>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${node.cpuUsedPct || 15}%` }} />
          </div>
          <div className="card-sub">{node.cpuUsedPct || 15}% 사용 중 ({node.cpuCores || 16} Cores, {node.processorType || 'Intel Xeon Gold'})</div>
        </div>

        <div className="summary-card">
          <div className="card-header">
            <span className="card-title">메모리 (RAM) 할당</span>
            <Database size={18} color="#10b981" />
          </div>
          <div className="card-value">{node.memoryUsedGb || 32} GB / {node.memoryGb || 64} GB</div>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill green" style={{ width: `${Math.round(((node.memoryUsedGb || 32) / (node.memoryGb || 64)) * 100)}%` }} />
          </div>
          <div className="card-sub">KVM 커널 페이지 공유 활성 (가용: {(node.memoryGb || 64) - (node.memoryUsedGb || 32)} GB)</div>
        </div>

        <div className="summary-card">
          <div className="card-header">
            <span className="card-title">호스팅 가상머신</span>
            <Monitor size={18} color="#6366f1" />
          </div>
          <div className="card-value">{vmsOnNode.length}대 VM 가동</div>
          <div className="card-sub">실행 중: {vmsOnNode.filter(v => v.status === 'Running').length}대</div>
        </div>

        <div className="summary-card">
          <div className="card-header">
            <span className="card-title">하이퍼바이저 커널</span>
            <Activity size={18} color="#f59e0b" />
          </div>
          <div className="card-value">{node.osImage || 'RHEL CoreOS'}</div>
          <div className="card-sub">{node.kernelVersion} (가동 시간: {node.uptime})</div>
        </div>
      </div>

      {/* VMs on Node Table */}
      <div className="content-panel" style={{ marginTop: '20px' }}>
        <div className="panel-header">
          <span className="panel-title">본 노드에서 호스팅 중인 가상머신 ({vmsOnNode.length})</span>
        </div>
        {vmsOnNode.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-sub)' }}>
            현재 본 호스트 노드에 배치된 가상머신이 없습니다.
          </div>
        ) : (
          <table className="vsphere-table">
            <thead>
              <tr>
                <th>상태</th>
                <th>가상머신 이름</th>
                <th>운영체제(OS)</th>
                <th>IP 주소</th>
                <th>vCPU</th>
                <th>메모리</th>
                <th>디스크</th>
                <th>가동 시간</th>
              </tr>
            </thead>
            <tbody>
              {vmsOnNode.map(vm => (
                <tr 
                  key={vm.id} 
                  className="clickable-row"
                  onClick={() => selectEntity('vm', vm.id)}
                >
                  <td><span className={`status-indicator-dot ${vm.status === 'Running' ? 'online' : 'offline'}`} /></td>
                  <td><strong>{vm.name}</strong></td>
                  <td>{vm.os}</td>
                  <td><code>{vm.ip || '-'}</code></td>
                  <td>{vm.vCpu} Cores</td>
                  <td>{vm.memoryGb} GB</td>
                  <td>{vm.disks?.length || 1}개 디스크</td>
                  <td>{vm.uptime || 'Running'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
