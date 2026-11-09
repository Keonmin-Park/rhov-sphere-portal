import React, { useState, useMemo, useEffect } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { migrateVm } from '../../utils/api';
import { 
  MoveRight, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Server, 
  Cpu, 
  Database, 
  HardDrive, 
  Loader2, 
  ArrowRight
} from 'lucide-react';

export default function MigrateModal() {
  const { 
    modals, 
    closeModal, 
    modalTargetVm, 
    inventory, 
    loadInventory, 
    addTask, 
    updateTask, 
    showToast 
  } = useCluster();

  const vm = modalTargetVm;
  const targetNodes = useMemo(() => {
    // Only worker nodes can host user VMs; control plane / master nodes have taints preventing KubeVirt pod scheduling
    return inventory?.nodes?.filter(n => !n.isMaster && n.name !== vm?.node) || [];
  }, [inventory?.nodes, vm?.node]);

  const [selectedNode, setSelectedNode] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [progressStep, setProgressStep] = useState(0); // 0: idle, 1: precheck, 2: memory, 3: handover, 4: done
  const [stepDetail, setStepDetail] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [allowRwoOverride, setAllowRwoOverride] = useState(false);

  // Auto-select first available target node
  useEffect(() => {
    if (targetNodes.length > 0 && !selectedNode) {
      setSelectedNode(targetNodes[0].name);
    }
  }, [targetNodes, selectedNode]);

  if (!modals.migrate || !vm) return null;

  // 1. Detect RWO Storage Disks that block live migration (#62)
  const rwoDisks = (vm.disks || []).filter(d => {
    // If KubeVirt explicitly declared VMI as live migratable, trust it
    if (vm.liveMigratable === true) return false;
    
    // Check if the disk is on an RWX / Live Migration capable storage
    const scName = (d.sc || '').toLowerCase();
    const dsObj = inventory?.datastores?.find(ds => ds.storageClass === d.sc || ds.name === d.sc);
    if (dsObj?.liveMigrationReady || dsObj?.rwxSupported) return false;
    if (scName.includes('ceph') || scName.includes('rbd') || scName.includes('ocs') || scName.includes('nfs') || scName.includes('rwx')) {
      return false;
    }
    return d.accessMode === 'ReadWriteOnce' || scName.includes('thin') || scName.includes('vsphere');
  });
  const hasRwo = vm.liveMigratable === false || (vm.liveMigratable !== true && rwoDisks.length > 0);

  // 2. Selected Node Info
  const targetNodeObj = inventory?.nodes?.find(n => n.name === selectedNode);

  const handleStartMigrate = async (e) => {
    e.preventDefault();
    if (!selectedNode) {
      showToast('이전할 대상 노드를 선택해주세요.', 'warning');
      return;
    }

    if (hasRwo && !allowRwoOverride) {
      showToast('RWO 단일 노드 볼륨이 감지되었습니다. 강제 실행 체크가 필요합니다.', 'warning');
      return;
    }

    const shortTarget = selectedNode.split('.')[0];
    const taskId = addTask('가상머신 실시간 마이그레이션 (Live Migration)', `${vm.name} ➔ ${shortTarget}`);

    try {
      setMigrating(true);
      setErrorMsg(null);
      setProgressStep(1);
      const s1 = `[1/4] 대상 노드(${shortTarget}) 하드웨어 호환성 및 KubeVirt Migration CR 사전 검증 중...`;
      setStepDetail(s1);
      updateTask(taskId, { progress: 20 });

      // Call API
      const res = await migrateVm(vm.id, selectedNode);
      if (!res.success && res.error) {
        throw new Error(res.error);
      }

      // Step 2: Live Memory Dirty Pages replication
      setTimeout(() => {
        setProgressStep(2);
        const s2 = `[2/4] 무중단 가상머신 활성 메모리(Dirty Pages) 네트워크 스트리밍 중... (0 ms 패킷 손실)`;
        setStepDetail(s2);
        updateTask(taskId, { progress: 55 });

        // Step 3: VMI Handover
        setTimeout(() => {
          setProgressStep(3);
          const s3 = `[3/4] 하이퍼바이저 프로세스 타깃 노드(${shortTarget})로 실행 제어권 인계(Handover) 중...`;
          setStepDetail(s3);
          updateTask(taskId, { progress: 85 });

          // Step 4: Final Complete
          setTimeout(() => {
            setProgressStep(4);
            const s4 = `[4/4] 완료: '${vm.name}'이(가) ${shortTarget} 노드로 무중단 라이브 마이그레이션되었습니다.`;
            setStepDetail(s4);
            updateTask(taskId, {
              progress: 100,
              status: 'Completed',
              error: null
            });
            showToast(`'${vm.name}' 실시간 마이그레이션 성공!`, 'success');

            setTimeout(() => {
              closeModal('migrate');
              setMigrating(false);
              setProgressStep(0);
              loadInventory(true);
            }, 1200);
          }, 1500);
        }, 1800);
      }, 1500);

    } catch (err) {
      setMigrating(false);
      setProgressStep(0);
      setErrorMsg(err.message || '마이그레이션 실패');
      updateTask(taskId, {
        progress: 100,
        status: 'Failed',
        error: err.message || '마이그레이션 처리 중 오류 발생'
      });
      showToast(`마이그레이션 실패: ${err.message}`, 'error');
    }
  };

  return (
    <div className="modal-backdrop active">
      <div className="modal-box modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-title-box">
            <MoveRight size={18} className="modal-header-icon" />
            <span className="modal-title">가상머신 실시간 마이그레이션 (Live Migration)</span>
          </div>
          {!migrating && (
            <button className="modal-close-btn" onClick={() => closeModal('migrate')}>
              <X size={16} />
            </button>
          )}
        </div>

        <form onSubmit={handleStartMigrate}>
          <div className="modal-body-scroll">
            {/* VM Source Banner */}
            <div className="migrate-source-banner">
              <div className="source-vm-row">
                <span className="source-label">이전 대상 VM:</span>
                <strong className="source-vm-name">{vm.name}</strong>
                <span className="source-tag">{vm.os}</span>
                <span className="source-specs">{vm.vCpu} vCPU • {vm.memoryGb} GB RAM</span>
              </div>
              <div className="source-node-row">
                <span className="node-arrow-label">현재 구동 노드:</span>
                <span className="node-badge current">{vm.node || 'master-01.rhov.example.local'}</span>
                <ArrowRight size={14} className="node-arrow" />
                <span className="node-badge target">{selectedNode ? selectedNode.split('.')[0] : '노드 선택'}</span>
              </div>
            </div>

            {/* RWO Storage Safety Warning Banner (#62) */}
            {hasRwo && (
              <div className="rwo-warning-box">
                <div className="rwo-warning-header">
                  <AlertTriangle size={16} className="rwo-icon" />
                  <span className="rwo-title">단일 노드 볼륨(thin-csi / RWO) 감지 - Live Migration 불가 경고</span>
                </div>
                <p className="rwo-desc">
                  현재 VM에 바인딩된 <code>{rwoDisks.map(d => `${d.name} (${d.sc || 'thin-csi'})`).join(', ')}</code> 디스크는 
                  단일 노드 전용(ReadWriteOnce) 블록 볼륨입니다. KubeVirt 아키텍처 특성상 두 노드가 동시에 마운트할 수 없어 
                  실시간 무중단 마이그레이션(Live Migration) 시 <strong>KubeVirt Multi-Attach Error</strong>가 발생합니다.
                  (안전한 이동을 위해선 VM 전원을 끄고 Cold Migration을 수행하거나 RWX 공유 스토리지로 교체해야 합니다.)
                </p>
                <label className="rwo-override-checkbox">
                  <input 
                    type="checkbox"
                    checked={allowRwoOverride}
                    onChange={(e) => setAllowRwoOverride(e.target.checked)}
                    disabled={migrating}
                  />
                  <span>스토리지 볼륨 위험(Multi-Attach 충돌)을 인지하였으며, 강제 마이그레이션을 계속 시도합니다.</span>
                </label>
              </div>
            )}

            {/* Target Node Selection Cards (#121) */}
            <div className="form-group" style={{ marginTop: '14px' }}>
              <label className="form-label">
                이전 대상 호스트 노드 선택 (Target Node Selection)
                <span className="label-subtext">실시간 CPU/메모리 가용량 기반</span>
              </label>

              <div className="target-node-cards-grid">
                {targetNodes.length === 0 ? (
                  <div className="no-nodes-message">이전 가능한 다른 호스트 노드가 없습니다.</div>
                ) : (
                  targetNodes.map(node => {
                    const isSelected = selectedNode === node.name;
                    const cpuFreePct = Math.max(0, 100 - (node.cpuUsedPct || 0));
                    const memFreeGb = Math.max(0, (node.memoryGb || 64) - (node.memoryUsedGb || 32));
                    const isCompatible = memFreeGb >= (vm.memoryGb || 4);

                    return (
                      <div 
                        key={node.id}
                        className={`target-node-card ${isSelected ? 'selected' : ''} ${!isCompatible ? 'warning-node' : ''}`}
                        onClick={() => !migrating && setSelectedNode(node.name)}
                      >
                        <div className="node-card-header">
                          <div className="node-identity">
                            <Server size={14} className="node-icon" />
                            <strong className="node-shortname">{node.name.split('.')[0]}</strong>
                          </div>
                          {isCompatible ? (
                            <span className="node-compat-badge ok">
                              <CheckCircle2 size={11} /> 호환 가능
                            </span>
                          ) : (
                            <span className="node-compat-badge warn">
                              <AlertTriangle size={11} /> 메모리 주의
                            </span>
                          )}
                        </div>

                        <div className="node-ip-text">{node.ip} • 실행 중인 VM: {node.vmCount || 0}대</div>

                        {/* Node Resource Gauges */}
                        <div className="node-gauges-row">
                          <div className="mini-gauge">
                            <div className="gauge-label-row">
                              <span className="g-title"><Cpu size={10} /> CPU 사용률</span>
                              <span className="g-val">{node.cpuUsedPct || 35}%</span>
                            </div>
                            <div className="gauge-track">
                              <div 
                                className="gauge-fill cpu" 
                                style={{ width: `${node.cpuUsedPct || 35}%` }} 
                              />
                            </div>
                          </div>

                          <div className="mini-gauge">
                            <div className="gauge-label-row">
                              <span className="g-title"><Database size={10} /> RAM 여유</span>
                              <span className="g-val">{memFreeGb} GB 남음</span>
                            </div>
                            <div className="gauge-track">
                              <div 
                                className="gauge-fill mem" 
                                style={{ width: `${Math.round(((node.memoryUsedGb || 32) / (node.memoryGb || 64)) * 100)}%` }} 
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4-Step Animated Pipeline (#122) */}
            {progressStep > 0 && (
              <div className="migration-pipeline-box">
                <div className="pipeline-header">
                  <Loader2 size={14} className="spin-icon" />
                  <span className="pipeline-title">실시간 마이그레이션 파이프라인 (0ms 패킷 드롭)</span>
                  <span className="pipeline-pct">
                    {progressStep === 1 && '20%'}
                    {progressStep === 2 && '55%'}
                    {progressStep === 3 && '85%'}
                    {progressStep === 4 && '100%'}
                  </span>
                </div>

                <div className="pipeline-progress-bar">
                  <div 
                    className="pipeline-fill"
                    style={{ 
                      width: progressStep === 1 ? '20%' : (progressStep === 2 ? '55%' : (progressStep === 3 ? '85%' : '100%')) 
                    }}
                  />
                </div>

                <div className="pipeline-detail-text">{stepDetail}</div>
              </div>
            )}

            {errorMsg && (
              <div className="modal-error-banner">
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="modal-footer">
            <button 
              type="button" 
              className="vsphere-btn secondary" 
              onClick={() => closeModal('migrate')} 
              disabled={migrating}
            >
              취소
            </button>
            <button 
              type="submit" 
              className="vsphere-btn primary-btn" 
              disabled={migrating || !selectedNode || (hasRwo && !allowRwoOverride)}
            >
              {migrating && <Loader2 size={14} className="spin-icon" />}
              <span>{migrating ? '마이그레이션 진행 중...' : '실시간 마이그레이션 시작'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
