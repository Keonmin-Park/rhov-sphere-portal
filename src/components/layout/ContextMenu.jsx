import React, { useEffect, useRef } from 'react';
import { useCluster } from '../../context/ClusterContext';
import { openWebConsole } from '../../utils/api';
import { 
  Play, 
  Square, 
  RotateCw, 
  PowerOff, 
  Terminal, 
  MoveRight, 
  Sliders, 
  Camera, 
  ChevronRight,
  Copy,
  Trash2
} from 'lucide-react';

export default function ContextMenu() {
  const { 
    contextMenu, 
    closeContextMenu, 
    openModal, 
    openPowerModal,
    showToast 
  } = useCluster();

  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeContextMenu();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu || !contextMenu.isOpen) return null;

  const { x, y, entityType, entityData } = contextMenu;
  if (entityType !== 'vm' || !entityData) return null;

  const vm = entityData;
  const isRunning = vm.status === 'Running';

  // Screen overflow prevention
  const menuWidth = 240;
  const menuHeight = 260;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 16);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 16);

  const handleAction = (actionCallback) => {
    closeContextMenu();
    actionCallback();
  };

  return (
    <div 
      ref={menuRef}
      className="vsphere-context-menu"
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
    >
      <div className="context-menu-header">
        <span className="context-vm-title">{vm.name}</span>
        <span className={`context-vm-status ${vm.status.toLowerCase()}`}>{vm.status}</span>
      </div>

      <div className="context-menu-divider" />

      {/* 1. Power Submenu */}
      <div className="context-menu-item has-submenu">
        <div className="item-label-group">
          <Play size={14} className="menu-icon" />
          <span>전원 제어 (Power)</span>
        </div>
        <ChevronRight size={13} className="submenu-arrow" />

        {/* Submenu Floating Flyout */}
        <div className="context-submenu-flyout">
          {isRunning ? (
            <>
              <button 
                type="button"
                className="submenu-item"
                onClick={() => handleAction(() => openPowerModal(vm, 'shutdown'))}
              >
                <Square size={13} className="icon-blue" />
                <span>게스트 OS 셧다운 (ACPI)</span>
              </button>

              <button 
                type="button"
                className="submenu-item"
                onClick={() => handleAction(() => openPowerModal(vm, 'restart'))}
              >
                <RotateCw size={13} className="icon-orange" />
                <span>재시작 (Restart)</span>
              </button>

              <button 
                type="button"
                className="submenu-item danger"
                onClick={() => handleAction(() => openPowerModal(vm, 'force'))}
              >
                <PowerOff size={13} className="icon-red" />
                <span>전원 강제 끄기 (Power Off)</span>
              </button>
            </>
          ) : (
            <button 
              type="button"
              className="submenu-item"
              onClick={() => handleAction(() => openPowerModal(vm, 'start'))}
            >
              <Play size={13} className="icon-green" />
              <span>전원 켜기 (Power On)</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Web Console */}
      <button 
        type="button"
        className="context-menu-item"
        disabled={!isRunning}
        onClick={() => handleAction(() => {
          if (!isRunning) {
            showToast('전원이 꺼진 VM의 콘솔은 실행할 수 없습니다.', 'warning');
            return;
          }
          openWebConsole(vm);
        })}
      >
        <div className="item-label-group">
          <Terminal size={14} className="menu-icon" />
          <span>웹 콘솔 실행 (Web Console)</span>
        </div>
      </button>

      <div className="context-menu-divider" />

      {/* 3. Live Migration */}
      <button 
        type="button"
        className="context-menu-item"
        onClick={() => handleAction(() => openModal('migrate', vm))}
      >
        <div className="item-label-group">
          <MoveRight size={14} className="menu-icon" />
          <span>실시간 마이그레이션 (Migrate)...</span>
        </div>
      </button>

      {/* 4. Edit Hardware Specs */}
      <button 
        type="button"
        className="context-menu-item"
        onClick={() => handleAction(() => openModal('editSpecs', vm))}
      >
        <div className="item-label-group">
          <Sliders size={14} className="menu-icon" />
          <span>하드웨어 사양 편집 (Edit Specs)...</span>
        </div>
      </button>

      {/* 5. Take Snapshot */}
      <button 
        type="button"
        className="context-menu-item"
        onClick={() => handleAction(() => openModal('snapshot', vm))}
      >
        <div className="item-label-group">
          <Camera size={14} className="menu-icon" />
          <span>스냅샷 생성 (Take Snapshot)...</span>
        </div>
      </button>

      {/* 6. Clone VM */}
      <button 
        type="button"
        className="context-menu-item"
        onClick={() => handleAction(() => openModal('clone', vm))}
      >
        <div className="item-label-group">
          <Copy size={14} className="menu-icon" />
          <span>가상머신 복제 (Clone VM)...</span>
        </div>
      </button>

      <div className="context-menu-divider" />

      {/* 7. Delete VM */}
      <button 
        type="button"
        className="context-menu-item danger"
        onClick={() => handleAction(() => openModal('deleteVm', vm))}
      >
        <div className="item-label-group" style={{ color: '#ef4444' }}>
          <Trash2 size={14} className="menu-icon" />
          <span>가상머신 삭제 (Delete VM)...</span>
        </div>
      </button>
    </div>
  );
}
