import React, { useState } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { 
  HardDrive, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Server, 
  Monitor, 
  Cpu, 
  ArrowRight,
  Database,
  Activity,
  ShieldCheck,
  FolderOpen
} from 'lucide-react';

export default function DatastoreView() {
  const { inventory, selectedEntity, selectEntity } = useCluster();
  const [activeTab, setActiveTab] = useState('summary');

  const datastores = inventory?.datastores || [];
  const selectedDs = datastores.find(d => d.id === selectedEntity?.id) || datastores[0];
  const isListView = selectedEntity?.type === 'datastores' || !selectedDs;

  // Aggregate metrics if in list view
  const totalCapTb = datastores.reduce((acc, d) => acc + (d.capacityTb || 0), 0);
  const totalUsedTb = datastores.reduce((acc, d) => acc + (d.usedTb || 0), 0);
  const totalFreeTb = Math.max(0, Math.round((totalCapTb - totalUsedTb) * 10) / 10);
  const overallUsedPct = totalCapTb > 0 ? Math.round((totalUsedTb / totalCapTb) * 100) : 0;

  // Single datastore metrics
  const dsCapTb = selectedDs?.capacityTb ?? 5.0;
  const dsUsedTb = selectedDs?.usedTb ?? 0;
  const dsFreeTb = selectedDs?.freeTb ?? Math.max(0.1, Math.round((dsCapTb - dsUsedTb) * 10) / 10);
  const dsUsedPct = dsCapTb > 0 ? Math.round((dsUsedTb / dsCapTb) * 100) : 0;
  
  const isCephRbd = selectedDs?.provisioner?.toLowerCase().includes('rbd') ||
                    selectedDs?.name?.toLowerCase().includes('ceph-rbd') ||
                    selectedDs?.storageClass?.toLowerCase().includes('ceph-rbd') ||
                    (selectedDs?.name?.toLowerCase().includes('ceph') && !selectedDs?.name?.toLowerCase().includes('cephfs') && !selectedDs?.name?.toLowerCase().includes('rgw'));
  const isThinOrVsphere = !isCephRbd && (selectedDs?.name?.toLowerCase().includes('thin') || 
                          selectedDs?.storageClass?.toLowerCase().includes('thin') || 
                          selectedDs?.provisioner?.toLowerCase().includes('vsphere') ||
                          selectedDs?.type?.toLowerCase().includes('vsphere'));
  const isRwx = isCephRbd ? true : (isThinOrVsphere ? false : (selectedDs?.rwxSupported || false));
  const attachedVms = selectedDs?.vms || [];

  return (
    <div className="vsphere-view-container">
      {/* 1. Header Banner */}
      <div className="view-header">
        <div className="view-title-row">
          <div className="view-icon-wrapper" style={{ background: 'rgba(0, 145, 218, 0.12)' }}>
            <HardDrive size={24} color="#0091da" />
          </div>
          <div>
            <div className="view-title">
              {isListView ? '데이터스토어 인벤토리 (Datastores)' : selectedDs?.name}
            </div>
            <div className="view-subtitle">
              {isListView 
                ? `OpenShift CSI 기반 스토리지 풀 • 총 ${datastores.length}개 데이터스토어`
                : `${selectedDs?.type} • StorageClass: ${selectedDs?.storageClass || selectedDs?.name}`}
            </div>
          </div>
        </div>

        <div className="view-header-badges">
          {!isListView && (
            <>
              {isRwx ? (
                <span className="badge-pill green" title="ReadWriteMany: 다중 노드 동시 마운트 가능">
                  <ShieldCheck size={13} style={{ marginRight: 4 }} />
                  Live Migration Ready (RWX)
                </span>
              ) : (
                <span className="badge-pill orange" title="ReadWriteOnce: 단일 노드 전용 블록 볼륨 (Multi-Attach 충돌 방지)">
                  <AlertTriangle size={13} style={{ marginRight: 4 }} />
                  Cold Migration Only (RWO)
                </span>
              )}
              <span className="badge-pill blue">
                VM {attachedVms.length}대 마운트
              </span>
            </>
          )}
          <span className="badge-pill gray">
            {isThinOrVsphere ? 'Thin Provisioned (RWO Block)' : (selectedDs?.provisioning || 'Thin Provisioned')}
          </span>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      {!isListView && (
        <div className="vsphere-tab-bar">
          <button 
            className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            요약 (Summary)
          </button>
          <button 
            className={`tab-btn ${activeTab === 'vms' ? 'active' : ''}`}
            onClick={() => setActiveTab('vms')}
          >
            가상머신 디스크 ({attachedVms.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'csi' ? 'active' : ''}`}
            onClick={() => setActiveTab('csi')}
          >
            CSI 구성 정보
          </button>
        </div>
      )}

      {/* 3. Tab Contents */}
      {isListView ? (
        /* ================= ALL DATASTORES LIST VIEW ================= */
        <div className="view-content-grid">
          {/* Summary Metric Card */}
          <div className="vsphere-card">
            <div className="card-header">
              <span className="card-title">클러스터 전체 스토리지 풀 용량</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-main)' }}>
                    {totalUsedTb} TB <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ {totalCapTb} TB</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    여유 공간: {totalFreeTb} TB ({100 - overallUsedPct}% 남음)
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: overallUsedPct > 80 ? '#ef4444' : '#10b981' }}>
                    {overallUsedPct}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>전체 할당률</div>
                </div>
              </div>

              <div style={{ width: '100%', height: 12, background: 'var(--bg-hover)', borderRadius: 6, overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${Math.min(100, overallUsedPct)}%`, 
                    height: '100%', 
                    background: overallUsedPct > 80 ? '#ef4444' : 'linear-gradient(90deg, #0091da, #10b981)',
                    borderRadius: 6,
                    transition: 'width 0.4s ease'
                  }} 
                />
              </div>
            </div>
          </div>

          {/* Datastores Table */}
          <div className="vsphere-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <span className="card-title">데이터스토어 목록 ({datastores.length})</span>
            </div>
            <div className="card-body no-padding">
              <table className="vsphere-table">
                <thead>
                  <tr>
                    <th>이름 (Name)</th>
                    <th>스토리지 유형 (Type)</th>
                    <th>StorageClass</th>
                    <th>총 용량</th>
                    <th>사용 용량</th>
                    <th>여유 공간</th>
                    <th>vMotion (Live Migration)</th>
                    <th>연결된 VM</th>
                  </tr>
                </thead>
                <tbody>
                  {datastores.map((ds) => (
                    <tr 
                      key={ds.id} 
                      className="clickable-row"
                      onClick={() => selectEntity('datastore', ds.id)}
                      title="클릭하여 상세 보기"
                    >
                      <td><strong>{ds.name}</strong></td>
                      <td>{ds.type}</td>
                      <td><code>{ds.storageClass || ds.name}</code></td>
                      <td>{ds.capacityTb} TB</td>
                      <td>{ds.usedTb} TB</td>
                      <td>{ds.freeTb} TB</td>
                      <td>
                        {(!ds.name?.toLowerCase().includes('thin') && !ds.storageClass?.toLowerCase().includes('thin') && !ds.provisioner?.toLowerCase().includes('vsphere') && ds.rwxSupported) ? (
                          <span className="badge-pill green">✅ RWX 지원 (Live Ready)</span>
                        ) : (
                          <span className="badge-pill orange">⚠️ RWO 전용 (Cold Only)</span>
                        )}
                      </td>
                      <td>{ds.vmCount || (ds.vms ? ds.vms.length : 0)}대</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'summary' ? (
        /* ================= SINGLE DATASTORE SUMMARY ================= */
        <div className="view-content-grid">
          {/* Capacity Gauge Card */}
          <div className="vsphere-card">
            <div className="card-header">
              <span className="card-title">데이터스토어 용량 할당 현황</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-main)' }}>
                    {dsUsedTb} TB <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>/ {dsCapTb} TB</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    사용 가능 여유 공간: <strong style={{ color: 'var(--text-main)' }}>{dsFreeTb} TB</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: dsUsedPct > 85 ? '#ef4444' : '#0091da' }}>
                    {dsUsedPct}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>프로비저닝률</div>
                </div>
              </div>

              <div style={{ width: '100%', height: 14, background: 'var(--bg-hover)', borderRadius: 7, overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${Math.min(100, dsUsedPct)}%`, 
                    height: '100%', 
                    background: dsUsedPct > 85 ? '#ef4444' : 'linear-gradient(90deg, #0091da, #059669)',
                    borderRadius: 7,
                    transition: 'width 0.4s ease'
                  }} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
                <div className="spec-item">
                  <span className="spec-label">프로비저닝 모델</span>
                  <span className="spec-value">{isThinOrVsphere ? 'Thin Provisioned (RWO Block)' : (selectedDs?.provisioning || 'Thin Provisioned')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Access Mode</span>
                  <span className="spec-value">{isRwx ? 'ReadWriteMany (RWX)' : 'ReadWriteOnce (RWO)'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Migration Safety Assessment Card (#2) */}
          <div className="vsphere-card">
            <div className="card-header">
              <span className="card-title">Live Migration (vMotion) 스토리지 안전성 검증</span>
            </div>
            <div className="card-body">
              {isRwx ? (
                <div className="status-banner success" style={{ marginBottom: 16 }}>
                  <ShieldCheck size={20} color="#10b981" />
                  <div>
                    <strong style={{ display: 'block', marginBottom: 2 }}>실시간 무중단 마이그레이션(Live Migration) 가능</strong>
                    <span style={{ fontSize: '11.5px', opacity: 0.9 }}>
                      이 데이터스토어는 다중 노드 동시 마운트(ReadWriteMany)를 지원하므로, VM이 실행 중인 상태에서도 워커 노드 간 패킷 단절 없이 vMotion이 즉각 수행됩니다.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="status-banner error" style={{ marginBottom: 16, background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                  <AlertTriangle size={20} color="#f59e0b" />
                  <div>
                    <strong style={{ display: 'block', marginBottom: 2, color: '#f59e0b' }}>단일 노드 종속 볼륨 (thin-csi / RWO - Live Migration 불가)</strong>
                    <span style={{ fontSize: '11.5px', opacity: 0.9, color: 'var(--text-main)', lineHeight: 1.5 }}>
                      <code>thin-csi</code>와 같은 vSphere FCD 블록 볼륨은 ReadWriteOnce(RWO) 모드로 동작합니다. 
                      KubeVirt Live Migration 특성상 소스/타겟 노드가 동시에 디스크를 마운트할 수 없어 <strong>Multi-Attach Error</strong>가 발생하므로 실시간 무중단 vMotion이 불가합니다. 
                      다른 노드로 이동하려면 반드시 VM 전원을 끄고 <strong>Cold Migration</strong>을 수행하거나, 디스크를 NFS/ODF와 같은 <strong>RWX 공유 스토리지</strong>로 교체해야 합니다.
                    </span>
                  </div>
                </div>
              )}

              <div className="spec-list">
                <div className="spec-item">
                  <span className="spec-label">CSI 드라이버</span>
                  <span className="spec-value">{selectedDs?.provisioner || 'kubernetes.io/no-provisioner'}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Reclaim Policy</span>
                  <span className="spec-value">{selectedDs?.reclaimPolicy || 'Delete'}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Volume Binding Mode</span>
                  <span className="spec-value">{selectedDs?.volumeBindingMode || 'Immediate'}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">연결 호스트 노드</span>
                  <span className="spec-value">클러스터 내 모든 호스트 ({inventory?.nodes?.length || 6}대)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Connected VMs Preview */}
          <div className="vsphere-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">이 데이터스토어에 마운트된 가상머신 ({attachedVms.length}대)</span>
              <button className="btn-table-action" onClick={() => setActiveTab('vms')}>
                전체 디스크 목록 보기 <ArrowRight size={13} style={{ marginLeft: 4 }} />
              </button>
            </div>
            <div className="card-body no-padding">
              {attachedVms.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  현재 이 데이터스토어를 루트/추가 디스크로 사용하는 가상머신이 없습니다.
                </div>
              ) : (
                <table className="vsphere-table">
                  <thead>
                    <tr>
                      <th>가상머신 이름</th>
                      <th>프로젝트 (Namespace)</th>
                      <th>디스크 볼륨 이름</th>
                      <th>볼륨 크기</th>
                      <th>실행 노드</th>
                      <th>VM 상태</th>
                      <th>vMotion 적합도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachedVms.slice(0, 6).map((vm, i) => (
                      <tr 
                        key={i} 
                        className="clickable-row"
                        onClick={() => selectEntity('vm', vm.id || vm.name)}
                        title="클릭하여 가상머신으로 이동"
                      >
                        <td><Monitor size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /><strong>{vm.name}</strong></td>
                        <td><code>{vm.namespace}</code></td>
                        <td>{vm.diskName || 'rootdisk'}</td>
                        <td>{vm.sizeGb} GiB</td>
                        <td>{vm.node || 'Unassigned'}</td>
                        <td><span className={`badge-pill ${vm.status === 'Running' ? 'green' : 'gray'}`}>{vm.status}</span></td>
                        <td>
                          {isRwx ? (
                            <span className="badge-pill green">✅ Live Migration 가능</span>
                          ) : (
                            <span className="badge-pill orange" title="vSphere RWO 볼륨으로 Multi-Attach 충돌이 발생하므로 VM 전원 종료 후 Cold Migration만 지원합니다">
                              ⚠️ Cold Migration 전용
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'vms' ? (
        /* ================= VIRTUAL MACHINE DISKS TAB ================= */
        <div className="view-content-grid">
          <div className="vsphere-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <span className="card-title">가상머신 디스크 상세 인벤토리 (Total {attachedVms.length} Volumes)</span>
            </div>
            <div className="card-body no-padding">
              <table className="vsphere-table">
                <thead>
                  <tr>
                    <th>가상머신</th>
                    <th>네임스페이스</th>
                    <th>디스크 볼륨명</th>
                    <th>용량 (GiB)</th>
                    <th>Access Mode</th>
                    <th>호스트 노드</th>
                    <th>VM 상태</th>
                    <th>마이그레이션 정책</th>
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
                      <td>{vm.diskName || 'rootdisk'}</td>
                      <td>{vm.sizeGb} GiB</td>
                      <td><code>{isThinOrVsphere ? 'ReadWriteOnce' : (vm.accessMode || (isRwx ? 'ReadWriteMany' : 'ReadWriteOnce'))}</code></td>
                      <td>{vm.node}</td>
                      <td><span className={`badge-pill ${vm.status === 'Running' ? 'green' : 'gray'}`}>{vm.status}</span></td>
                      <td>
                        {isRwx ? (
                          <span className="badge-pill green">무중단 Live Migration 허용</span>
                        ) : (
                          <span className="badge-pill orange" title="vSphere RWO 블록 디스크: Multi-Attach 에러 방지를 위해 Cold Migration 전용">
                            노드 고정 (Cold 이동 필요)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= CSI DETAILS TAB ================= */
        <div className="view-content-grid">
          <div className="vsphere-card">
            <div className="card-header">
              <span className="card-title">Kubernetes StorageClass 매니페스트 메타데이터</span>
            </div>
            <div className="card-body">
              <div className="spec-list">
                <div className="spec-item">
                  <span className="spec-label">StorageClass Name</span>
                  <span className="spec-value"><code>{selectedDs?.storageClass || selectedDs?.name}</code></span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Provisioner Driver</span>
                  <span className="spec-value"><code>{selectedDs?.provisioner || 'kubernetes.io/no-provisioner'}</code></span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Reclaim Policy</span>
                  <span className="spec-value">{selectedDs?.reclaimPolicy || 'Delete'}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Volume Binding Mode</span>
                  <span className="spec-value">{selectedDs?.volumeBindingMode || 'Immediate'}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Allow Volume Expansion</span>
                  <span className="spec-value">True (무중단 온라인 볼륨 확장 지원)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="vsphere-card">
            <div className="card-header">
              <span className="card-title">vSphere 호환성 및 운영자 가이드</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-main)', marginBottom: 12 }}>
                {selectedDs?.desc || 'OpenShift Virtualization 스토리지 백엔드입니다.'}
              </p>
              <div style={{ background: 'var(--bg-hover)', padding: '12px 14px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                💡 <strong>SRE 운영 팁:</strong> KubeVirt 가상머신을 다른 호스트 노드로 Live Migration(vMotion)하려면 루트 디스크 및 모든 추가 볼륨이 반드시 RWX(ReadWriteMany)를 지원하는 스토리지 클래스에 바인딩되어 있어야 합니다.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
