import { Injectable, inject } from '@angular/core';
import { generateGuid } from '@foblex/utils';
import { Connection, CrmNode } from '../models/crm.models';
import { FlowStateService } from './flow-state.service';
import { FoblexIdManagerService } from './foblex-id-manager.service';

@Injectable({
  providedIn: 'root'
})
export class TemporaryNodeService {
  private readonly flowStateService = inject(FlowStateService);
  private readonly foblexIdManager = inject(FoblexIdManagerService);

  handleDropOnConnection(connectionId: string, nodeType: string): void {
    // 1. Trouver la connexion existante
    const existingConnection = this.flowStateService.connections().find(c => c.id === connectionId);
    if (!existingConnection) return;

    // 2. Récupérer le nœud source pour obtenir sa position Y
    const sourceNode = this.flowStateService.getNodeFromConnectionId(connectionId, true);
    if (!sourceNode) return;

    // 3. Créer le nouveau nœud
    const newNode: CrmNode = {
      id: generateGuid(),
      type: nodeType,
      text: nodeType,
      position: { x: 0, y: sourceNode.position.y },
      maxInputs: this.flowStateService.getDefaultMaxInputs(nodeType),
      maxOutputs: this.flowStateService.getDefaultMaxOutputs(nodeType)
    };

    // 4. Recalculer les positions et ajouter le nœud
    this.flowStateService.recalculateNodesPositions(sourceNode.id, newNode);

    // 5. Supprimer l'ancienne connexion et mettre à jour les IDs Foblex
    this.flowStateService.removeConnection(connectionId);

    // 6. Créer les nouvelles connexions
    const inputConnection: Connection = {
      id: generateGuid(),
      sourceId: existingConnection.sourceId,
      targetId: `input_${newNode.id}`
    };

    const outputConnection: Connection = {
      id: generateGuid(),
      sourceId: `output_${newNode.id}`,
      targetId: existingConnection.targetId
    };

    // 7. Ajouter les nouvelles connexions
    this.flowStateService.addConnection(inputConnection);
    this.flowStateService.addConnection(outputConnection);

    // 8. Forcer une nouvelle synchronisation des IDs
    this.foblexIdManager.requestSync();
  
  }
}