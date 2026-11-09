import React from 'react';
import { useCluster } from '../../../context/ClusterContext';
import { Sliders, Cpu, Database, HardDrive, Network } from 'lucide-react';

export default function VmConfigureTab() {
  const { selectedVmDetail, openModal } = useCluster();
  const vm = selectedVmDetail;

  if (!vm) return null;

  return (
    <div className="vm-configure-tab-content">
      {/* Top Banner with Edit Button */}
      <div className="content-panel" style={{ marginBottom: '16px' }}>
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="#0091da" />
            <span className="panel-title">하드웨어 사양 구성 (Hardware Configuration)</span>
          </div>
          <button className="header-btn-primary" onClick={() => openModal('editSpecs', vm)}>
            <Sliders size={14} />
            <span>하드웨어 사양 편집</span>
          </button>
        </div>
      </div>

      {/* Hardware Specs Table */}
      <div className="content-panel">
        <table className="vsphere-table">
          <thead>
            <tr>
              <th style={{ width: '180px' }}>하드웨어 구성요소</th>
              <th style={{ width: '220px' }}>할당 값 (Specification)</th>
              <th>상세 정보 및 스토리지 / 포트그룹 매핑</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={16} color="#0091da" />
                  <strong>CPU (프로세서)</strong>
                </div>
              </td>
              <td><strong>{vm.vCpu} Cores</strong></td>
              <td>소켓 1개 × 코어 {vm.vCpu}개 (KubeVirt QEMU/KVM Virtual CPU)</td>
            </tr>
            <tr>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={16} color="#10b981" />
                  <strong>메모리 (RAM)</strong>
                </div>
              </td>
              <td><strong>{vm.memoryGb} GiB</strong></td>
              <td>동적 벌루닝 활성, 메모리 오버커밋(Overcommit) 지원</td>
            </tr>
            {/* Disks */}
            {(vm.disks || []).map((disk, idx) => (
              <tr key={`disk-${idx}`}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HardDrive size={16} color="#6366f1" />
                    <strong>하드 디스크 {idx + 1}</strong>
                  </div>
                </td>
                <td><strong>{disk.sizeGb} GiB</strong></td>
                <td>
                  이름: <code>{disk.name}</code> • PVC: <code>{disk.pvc || `${vm.name}-${disk.name}`}</code> • 스토리지 클래스: <code>{disk.sc || '기본 스토리지'}</code>
                  {idx === 0 && <span className="badge-pill blue" style={{ marginLeft: '8px' }}>부트 디스크</span>}
                </td>
              </tr>
            ))}
            {/* NICs */}
            {(vm.nics || []).map((nic, idx) => (
              <tr key={`nic-${idx}`}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Network size={16} color="#f59e0b" />
                    <strong>네트워크 어댑터 {idx + 1}</strong>
                  </div>
                </td>
                <td><strong>{nic.name}</strong></td>
                <td>
                  네트워크: <code>{nic.network}</code> • MAC: <code>{nic.mac || '52:54:00:xx:xx:xx'}</code> • 드라이버: {nic.model || 'virtio'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
