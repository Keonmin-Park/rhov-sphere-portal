# OpenShift Virtualization (KubeVirt) 핵심 아키텍처 및 트러블슈팅 노트

운영팀이 포털에만 의존(Lock-in)하지 않고 Kubernetes 네이티브 가상화 원리를 이해하며 운영할 수 있도록 정리한 핵심 아키텍처 및 트러블슈팅 가이드입니다.

---

## 1. VMware vSphere vs KubeVirt 핵심 개념 매핑

KubeVirt는 가상머신(VM)을 별도의 하이퍼바이저 전용 클러스터가 아닌 **일반 Kubernetes Pod(`virt-launcher`) 내부의 `qemu-kvm` 프로세스**로 캡슐화하여 구동합니다.

| VMware vSphere | OpenShift Virtualization (KubeVirt) | 동작 원리 요약 |
| :--- | :--- | :--- |
| **ESXi Host** | Worker Node (`RHCOS` + `/dev/kvm`) | Linux 커널 KVM 모듈을 통해 하드웨어 가상화 가속 제공 |
| **VM (`.vmx`)** | `VirtualMachine` (CRD) | VM의 CPU, Memory, Disk, Network 스펙을 정의하는 선언적 리소스 |
| **실행 중인 VM** | `VirtualMachineInstance` (`VMI`) + `virt-launcher` Pod | 전원이 켜졌을 때 실제로 워커 노드에 스케줄링되어 구동되는 인스턴스 |
| **vMotion** | `VirtualMachineInstanceMigration` (`VMIM`) | 소스 파드와 타겟 파드 간 실시간 메모리 프리카피(Pre-copy) 및 핸드오버 |
| **Datastore** | `PersistentVolumeClaim` (`PVC`) / `StorageClass` | CSI 기반 볼륨 (`RWX` 공유 스토리지 vs `RWO` 블록 스토리지) |
| **vSwitch / PortGroup** | `OVN-Kubernetes` + `Multus CNI` (`Linux Bridge`) | 기본 Pod 오버레이 망 + 외부 L2 물리망 브리지 이중 구성 |

---

## 2. 주요 아키텍처 설계 및 트러블슈팅 (RCA)

### [Case 1] `thin-csi` (RWO) 볼륨의 Live Migration 실패 (`Multi-Attach error`) 분석

* **현상**:
  VMware 기본 CSI(`thin-csi`)로 생성한 VM에 대해 무중단 실시간 마이그레이션(Live Migration)을 실행하면, 타겟 노드의 `virt-launcher` 파드가 `ContainerCreating`에서 멈추고 아래 이벤트가 발생함.
  ```text
  Warning  FailedAttachVolume  attachdetach-controller
  Multi-Attach error for volume "pvc-..." Volume is already exclusively attached to one node and can't be attached to another
  ```
* **원인 (RCA)**:
  1. KubeVirt의 Live Migration은 소스 노드의 기존 `virt-launcher` 파드가 살아있는 상태에서 **타겟 노드에 새로운 `virt-launcher` 파드를 동시에 띄워 두 노드가 동일한 PVC 볼륨을 동시에 마운트**한 뒤 메모리를 동기화하는 구조임.
  2. 반면 `thin-csi`는 단일 노드 독점 마운트(`ReadWriteOnce`, RWO)만 허용하므로, Kubernetes의 `attachdetach-controller`가 데이터 손상을 막기 위해 타겟 노드의 추가 마운트를 차단함.
* **해결 및 가드레일 적용**:
  1. 무중단 Live Migration이 필요한 워크로드는 다중 노드 동시 마운트를 지원하는 **`ReadWriteMany` (RWX) 스토리지(`nfs-rwx`, `ODF Ceph RBD`)**를 사용하도록 표준화(Ping 손실 0% 검증 완료).
  2. `RWO` 볼륨을 사용하는 VM은 정지(`Stop`) 후 노드를 변경해 재기동하는 **Cold Migration**만 수행하도록 운영 절차를 분리하고, 포털 UI(`MigrateModal.jsx`)에서도 RWO 디스크 감지 시 Live Migration을 사전 차단하도록 안전장치를 구현함.

---

### [Case 2] 기존 사내망 고정 IP 유지를 위한 듀얼 네트워크 (OVN + Multus L2 Bridge) 설계

* **과제**:
  Kubernetes 기본 Pod 네트워크(`OVN-Kubernetes`)는 클러스터 내부 사설 대역(`10.128.0.0/14`)과 NAT(Masquerade)를 사용하므로, 기존 VMware에서 쓰던 사내망 고정 IP로 외부에서 직접 접근할 수 없음.
* **해결 설계**:
  1. 각 워커 노드에 물리/가상 NIC를 2개(`ens33`, `ens34`)로 분리 장착.
  2. `NMState Operator` (`NodeNetworkConfigurationPolicy`)를 통해 두 번째 NIC(`ens34`)에 IP가 할당되지 않은 **순수 L2 Linux Bridge(`br0`, STP 비활성화)**를 선언적으로 생성.
  3. `Multus CNI` (`NetworkAttachmentDefinition`)를 통해 VM에 두 번째 네트워크 인터페이스를 장착하여 사내 물리망과 L2 레벨로 1:1 직결(포트포워딩 없이 기존 고정 IP 그대로 통신).

---

### [Case 3] VMware ➔ KubeVirt 이관(MTV) 시 발생한 주요 이슈 해결

1. **VDDK InitContainer `Init:0/1` 무한 대기 해결**:
   * **원인**: VMware VMDK 디스크 변환용 VDDK 라이브러리를 전달하는 `InitContainer`의 `ENTRYPOINT`가 `sleep infinity`로 작성되어 종료되지 않음. Kubernetes의 `InitContainer`는 작업을 마치고 반드시 **`Exit Code 0`으로 정상 종료되어야 메인 컨테이너(`virt-v2v`)가 시작**됨.
   * **해결**: 공유 `emptyDir` 볼륨(`/opt`)에 라이브러리를 복사(`cp -r`)한 직후 프로세스가 즉시 종료되도록 이미지를 재빌드하여 해결.
2. **이관 후 게스트 OS 네트워크 `disconnected` (`ens33` ➔ `enp1s0`) 해결**:
   * **원인**: VMware 환경에서는 NIC가 `VMXNET3` 드라이버(`ens33`)였으나, KubeVirt로 변환되면서 KVM 표준 반가상화 드라이버인 `VirtIO` PCI 장치(`enp1s0`)로 하드웨어 식별자가 변경되어 기존 NetworkManager 프로필이 매핑되지 않음.
   * **해결**: 이관 직후 `nmcli connection modify ens33 connection.interface-name enp1s0`으로 디바이스명을 매핑하여 정상 개통.
