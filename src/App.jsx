import React from 'react';
import { ClusterProvider, useCluster } from './context/ClusterContext';
import TopHeader from './components/layout/TopHeader';
import LeftSidebarTree from './components/layout/LeftSidebarTree';
import MainContent from './components/layout/MainContent';
import RecentTasksDrawer from './components/layout/RecentTasksDrawer';
import ContextMenu from './components/layout/ContextMenu';
import EditSpecsModal from './components/modals/EditSpecsModal';
import CreateVmModal from './components/modals/CreateVmModal';
import MigrateModal from './components/modals/MigrateModal';
import SnapshotModal from './components/modals/SnapshotModal';
import ConnectModal from './components/modals/ConnectModal';
import PowerActionModal from './components/modals/PowerActionModal';
import CloneVmModal from './components/modals/CloneVmModal';
import CreateNamespaceModal from './components/modals/CreateNamespaceModal';
import DeleteVmModal from './components/modals/DeleteVmModal';
import './styles/vsphere-theme.css';
import './styles/react-layout.css';

function PortalLayout() {
  const { toast } = useCluster();

  return (
    <div className="vsphere-app-wrapper">
      {/* 1. Top Navigation Bar */}
      <TopHeader />

      {/* 2. Main Portal Split: Left Inventory Tree & Right Content View */}
      <div className="vsphere-body-container">
        <LeftSidebarTree />
        <main className="vsphere-main-viewport">
          <MainContent />
        </main>
      </div>

      {/* 3. Bottom Recent Tasks Tray (#161, #162) */}
      <RecentTasksDrawer />

      {/* 4. Global Modals & Overlays */}
      <PowerActionModal />
      <EditSpecsModal />
      <CreateVmModal />
      <MigrateModal />
      <SnapshotModal />
      <ConnectModal />
      <CloneVmModal />
      <CreateNamespaceModal />
      <DeleteVmModal />

      {/* 5. Right-Click Context Menu (#6) */}
      <ContextMenu />

      {/* 6. Global Toast Notification */}
      {toast && (
        <div className={`global-toast-banner ${toast.type}`}>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ClusterProvider>
      <PortalLayout />
    </ClusterProvider>
  );
}
