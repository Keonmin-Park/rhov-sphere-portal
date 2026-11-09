import React, { useState } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { 
  Network, 
  Layers, 
  Server, 
  Monitor, 
  ShieldCheck, 
  ArrowRight,
  GitBranch,
  Cpu,
  Wifi,
  ExternalLink,
  CheckCircle2,
  Info
} from 'lucide-react';

export default function NetworkView() {
  const { inventory, selectedEntity, selectEntity } = useCluster();
  const [activeTab, setActiveTab] = useState('topology');

  const networks = inventory?.networks || [];
  const selectedNet = networks.find(n => n.id === selectedEntity?.id) || networks[0];
  const isListView = selectedEntity?.type === 'networks' || !selectedNet;

  const attachedVms = selectedNet?.vms || [];
  const isDefaultOvn = selectedNet?.isDefault || selectedNet?.name?.includes('ovn') || selectedNet?.name?.includes('default');

  return (
    <div className="vsphere-view-container">
      {/* 1. Header Banner */}
      <div className="view-header">
        <div className="view-title-row">
          <div className="view-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
            <Network size={24} color="#10b981" />
          </div>
          <div>
            <div className="view-title">
              {isListView ? '가상 네트워크 인벤토리 (Networks & vSwitches)' : selectedNet?.name}
            </div>
            <div className="view-subtitle">
              {isListView 
                ? `OpenShift CNI & Multus L2 브릿지 • 총 ${networks.length}개 가상 네트워크`
                : `${selectedNet?.type} • VLAN: ${selectedNet?.vlan || 'Untagged'}`}
            </div>
          </div>
        </div>

        <div className="view-header-badges">
          {!isListView && (
            <>
              {isDefaultOvn ? (
                <span className="badge-pill blue">
                  <ShieldCheck size={13} style={{ marginRight: 4 }} />
                  Cluster Default Pod Network (OVN)
                </span>
              ) : (
                <span className="badge-pill green">
                  <GitBranch size={13} style={{ marginRight: 4 }} />
                  Multus L2 Dedicated Bridge
                </span>
              )}
              <span className="badge-pill gray">
                VM {attachedVms.length}대 연결됨
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      {!isListView && (
        <div className="vsphere-tab-bar">
          <button 
            className={`tab-btn ${activeTab === 'topology' ? 'active' : ''}`}
            onClick={() => setActiveTab('topology')}
          >
            vSwitch 토폴로지 (Virtual Switch Diagram)
          </button>
          <button 
            className={`tab-btn ${activeTab === 'ports' ? 'active' : ''}`}
            onClick={() => setActiveTab('ports')}
          >
            연결된 가상머신 포트 ({attachedVms.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            네트워크 구성 상세
          </button>
        </div>
      )}

      {/* 3. Tab Contents */}
      {isListView ? (
        /* ================= ALL NETWORKS LIST VIEW ================= */
        <div className="view-content-grid">
          <div className="vsphere-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <span className="card-title">클러스터 가상 네트워크 목록 ({networks.length})</span>
            </div>
            <div className="card-body no-padding">
              <table className="vsphere-table">
                <thead>
                  <tr>
                    <th>네트워크 이름 (PortGroup)</th>
                    <th>CNI 아키텍처</th>
                    <th>VLAN ID</th>
                    <th>IPAM 서브넷 (CIDR)</th>
                    <th>물리 업링크 (Uplink)</th>
                    <th>연결된 VM 수</th>
                    <th>용도 및 특성</th>
                  </tr>
                </thead>
                <tbody>
                  {networks.map(net => (
                    <tr 
                      key={net.id}
                      className="clickable-row"
                      onClick={() => selectEntity('network', net.id)}
                      title="클릭하여 vSwitch 토폴로지 및 상세 보기"
                    >
                      <td><strong>{net.name}</strong></td>
                      <td>
                        <span className={`badge-pill ${net.isDefault ? 'blue' : 'green'}`}>
                          {net.type}
                        </span>
                      </td>
                      <td><code>{net.vlan || 'Overlay'}</code></td>
                      <td><code>{net.cidr || '10.128.0.0/14'}</code></td>
                      <td>{net.uplink || 'bond0 (10GbE)'}</td>
                      <td>{net.vms ? net.vms.length : 0}대</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{net.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'topology' ? (
        /* ================= VSWITCH TOPOLOGY DIAGRAM TAB (#3) ================= */
        <div className="view-content-grid">
          <div className="vsphere-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">vSphere 표준/분산 스위치 토폴로지 (Virtual Switch Topology)</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                실제 물리 NIC부터 가상머신 vNIC까지의 L2/L3 패킷 플로우
              </span>
            </div>
            <div className="card-body">
              {/* Interactive Diagram Container */}
              <div className="vswitch-diagram-wrapper">
                
                {/* 1. Left: Physical Uplinks */}
                <div className="diagram-column uplinks-col">
                  <div className="diagram-col-title">물리 어댑터 (Physical Uplinks)</div>
                  
                  <div className="diagram-box uplink-box">
                    <div className="box-header">
                      <Wifi size={14} color="#0091da" />
                      <strong>vmnic0 (ens192)</strong>
                    </div>
                    <div className="box-sub">10,000 Mbps Full Duplex</div>
                    <div className="box-badge green">Link Up (Active)</div>
                  </div>

                  <div className="diagram-box uplink-box">
                    <div className="box-header">
                      <Wifi size={14} color="#0091da" />
                      <strong>vmnic1 (ens224)</strong>
                    </div>
                    <div className="box-sub">10,000 Mbps Full Duplex</div>
                    <div className="box-badge gray">Standby Uplink</div>
                  </div>
                </div>

                {/* Connecting Bus 1 */}
                <div className="diagram-bus">
                  <div className="bus-line horizontal"></div>
                </div>

                {/* 2. Middle: Virtual Switch Core & Port Group */}
                <div className="diagram-column switch-col">
                  <div className="diagram-col-title">가상 스위치 코어 (vSwitch Core)</div>
                  
                  <div className="diagram-box switch-core-box">
                    <div className="switch-core-header">
                      <Network size={16} color="#10b981" />
                      <div>
                        <strong>vSwitch0 ({isDefaultOvn ? 'OVN Bridge' : 'Linux L2 Bridge'})</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MTU: 1500 • Promiscuous: Reject</div>
                      </div>
                    </div>

                    <div className="portgroup-block">
                      <div className="pg-title-row">
                        <span className="pg-tag">포트 그룹 (PortGroup)</span>
                        <strong className="pg-name">{selectedNet?.name}</strong>
                      </div>
                      <div className="pg-meta">
                        <span>VLAN ID: <strong>{selectedNet?.vlan || '4096'}</strong></span>
                        <span>서브넷: <strong>{selectedNet?.cidr || '10.128.0.0/14'}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connecting Bus 2 */}
                <div className="diagram-bus">
                  <div className="bus-line horizontal"></div>
                </div>

                {/* 3. Right: Virtual Machine Ports */}
                <div className="diagram-column vms-col">
                  <div className="diagram-col-title">연결된 가상머신 (VM Virtual Ports)</div>
                  
                  {attachedVms.length === 0 ? (
                    <div className="diagram-box empty-vms-box">
                      연결된 활성 VM 포트 없음
                    </div>
                  ) : (
                    attachedVms.map((vm, idx) => (
                      <div 
                        key={idx} 
                        className="diagram-box vm-port-box clickable-box"
                        onClick={() => selectEntity('vm', vm.id || vm.name)}
                        title="클릭하여 가상머신 상세 보기"
                      >
                        <div className="vm-port-header">
                          <Monitor size={14} color="#0091da" />
                          <strong>{vm.name}</strong>
                          <span className={`status-dot ${vm.status === 'Running' ? 'green' : 'gray'}`}></span>
                        </div>
                        <div className="vm-port-details">
                          <div>IP: <code>{vm.ip || '-'}</code></div>
                          <div>MAC: <code>{vm.mac || '52:54:00:xx:xx:xx'}</code></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>

              {/* Diagram Footer Explanation */}
              <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg-hover)', borderRadius: '6px', fontSize: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Info size={18} color="#0091da" style={{ flexShrink: 0 }} />
                <span>
                  <strong>vSphere & OpenShift 네트워크 매핑 구조:</strong> 기존 VMware의 <code>PortGroup</code> 및 <code>VLAN Tagging</code>은 OpenShift Virtualization에서 <code>NetworkAttachmentDefinition (Multus)</code>과 <code>OVN-Kubernetes Geneve Overlay</code>로 1:1 매핑되어 구동됩니다.
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'ports' ? (
        /* ================= CONNECTED PORTS TAB ================= */
        <div className="view-content-grid">
          <div className="vsphere-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <span className="card-title">연결된 가상머신 vNIC 포트 목록 ({attachedVms.length})</span>
            </div>
            <div className="card-body no-padding">
              {attachedVms.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  현재 이 가상 네트워크에 연결된 가상머신 인터페이스가 없습니다.
                </div>
              ) : (
                <table className="vsphere-table">
                  <thead>
                    <tr>
                      <th>가상머신</th>
                      <th>프로젝트 (Namespace)</th>
                      <th>IP 주소</th>
                      <th>MAC 주소</th>
                      <th>호스트 노드</th>
                      <th>상태</th>
                      <th>바인딩 모드</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachedVms.map((vm, i) => (
                      <tr 
                        key={i} 
                        className="clickable-row"
                        onClick={() => selectEntity('vm', vm.id || vm.name)}
                        title="클릭하여 가상머신으로 이동"
                      >
                        <td><strong>{vm.name}</strong></td>
                        <td><code>{vm.namespace}</code></td>
                        <td><code>{vm.ip || '-'}</code></td>
                        <td><code>{vm.mac || '52:54:00:xx:xx:xx'}</code></td>
                        <td>{vm.node || 'Unassigned'}</td>
                        <td><span className={`badge-pill ${vm.status === 'Running' ? 'green' : 'gray'}`}>{vm.status}</span></td>
                        <td>{isDefaultOvn ? 'Masquerade (Default)' : 'L2 Bridge Direct'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ================= NETWORK CONFIG TAB ================= */
        <div className="view-content-grid">
          <div className="vsphere-card">
            <div className="card-header">
              <span className="card-title">네트워크 인터페이스 스펙</span>
            </div>
            <div className="card-body">
              <div className="spec-list">
                <div className="spec-item">
                  <span className="spec-label">네트워크 명칭</span>
                  <span className="spec-value"><code>{selectedNet?.name}</code></span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">CNI 아키텍처</span>
                  <span className="spec-value">{selectedNet?.type}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">VLAN 태그</span>
                  <span className="spec-value">{selectedNet?.vlan || 'Untagged / Geneve Overlay'}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">IPAM Subnet (CIDR)</span>
                  <span className="spec-value"><code>{selectedNet?.cidr || '10.128.0.0/14'}</code></span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">기본 게이트웨이</span>
                  <span className="spec-value"><code>{selectedNet?.gateway || '10.128.0.1'}</code></span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">DNS 리졸버</span>
                  <span className="spec-value"><code>{selectedNet?.dns || '172.30.0.10'}</code></span>
                </div>
              </div>
            </div>
          </div>

          <div className="vsphere-card">
            <div className="card-header">
              <span className="card-title">vSphere 가상 분산 스위치(DVS) 연동 설명</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-main)', marginBottom: 14 }}>
                {selectedNet?.desc || 'OpenShift 가상머신 전용 네트워크 인터페이스입니다.'}
              </p>
              <div style={{ background: 'var(--bg-hover)', padding: '12px 14px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                💡 <strong>Multus L2 Bridge 특징:</strong> vSphere의 사내 IDC 서브넷(VLAN 200)에 존재하는 레거시 물리/가상 서버들과 동일한 브로드캐스트 도메인으로 직접 패킷을 교환하므로, IP 변경이나 NAT 포트 포워딩 없이 원활한 무중단 마이그레이션이 가능합니다.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
