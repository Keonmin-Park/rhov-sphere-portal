import React from 'react';
import { useCluster } from '../../context/ClusterContext';
import DatacenterView from '../views/DatacenterView';
import ClusterView from '../views/ClusterView';
import NodeView from '../views/NodeView';
import VmDetailView from '../views/VmDetailView';
import DatastoreView from '../views/DatastoreView';
import NetworkView from '../views/NetworkView';

export default function MainContent() {
  const { selectedEntity } = useCluster();

  switch (selectedEntity?.type) {
    case 'datacenter':
      return <DatacenterView />;
    case 'cluster':
      return <ClusterView />;
    case 'node':
      return <NodeView />;
    case 'vm':
      return <VmDetailView />;
    case 'datastore':
    case 'datastores':
      return <DatastoreView />;
    case 'network':
    case 'networks':
      return <NetworkView />;
    default:
      return <DatacenterView />;
  }
}
