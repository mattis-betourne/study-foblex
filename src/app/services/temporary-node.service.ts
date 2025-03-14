import { Injectable, NgZone, inject } from '@angular/core';
import { generateGuid } from '@foblex/utils';
import { Connection, CrmNode } from '../models/crm.models';
import { FlowStateService } from './flow-state.service';
import { FoblexIdManagerService } from './foblex-id-manager.service';
import { HistoryService } from './history.service';

@Injectable({
  providedIn: 'root'
})
export class TemporaryNodeService {
  private readonly flowStateService = inject(FlowStateService);
  private readonly foblexIdManager = inject(FoblexIdManagerService);
  private readonly ngZone = inject(NgZone);
  private readonly historyService = inject(HistoryService);

  handleDropOnConnection(connectionId: string, nodeType: string): void {
    console.log(`Handling drop of ${nodeType} on connection ${connectionId}`);
    
    // 1. Trouver la connexion existante
    const existingConnection = this.flowStateService.connections().find(c => c.id === connectionId);
    if (!existingConnection) {
      console.error('Connection not found:', connectionId);
      return;
    }

    // 2. Récupérer les nœuds source et cible pour obtenir leurs positions
    const sourceId = existingConnection.sourceId.replace('output_', '');
    const targetId = existingConnection.targetId.replace('input_', '');
    
    const sourceNode = this.flowStateService.nodes().find(n => n.id === sourceId);
    const targetNode = this.flowStateService.nodes().find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) {
      console.error('Source or target node not found for connection:', existingConnection);
      return;
    }

    // 3. Calculer la position du nouveau nœud (au milieu entre source et cible)
    const newX = (sourceNode.position.x + targetNode.position.x) / 2;
    const newY = sourceNode.position.y; // Garder la même hauteur que le nœud source

    // 4. Créer le nouveau nœud
    const newNode: CrmNode = {
      id: generateGuid(),
      type: nodeType,
      text: nodeType,
      position: { x: newX, y: newY },
      maxInputs: this.flowStateService.getDefaultMaxInputs(nodeType),
      maxOutputs: this.flowStateService.getDefaultMaxOutputs(nodeType)
    };

    console.log('Creating new node:', newNode);

    // 5. Supprimer l'ancienne connexion
    this.flowStateService.removeConnection(connectionId);

    // 6. Ajouter le nouveau nœud
    this.flowStateService.addNode(newNode);
    
    // 7. Créer les nouvelles connexions
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

    // 8. Ajouter les nouvelles connexions
    this.flowStateService.addConnection(inputConnection);
    this.flowStateService.addConnection(outputConnection);

    console.log('Added new connections:', inputConnection, outputConnection);
    
    // 9. Vérifier et réparer l'état si nécessaire
    const wasRepaired = this.flowStateService.validateAndRepairState();
    if (wasRepaired) {
      console.log('State was repaired during drop operation');
    }

    // 10. Recalculer toutes les positions pour assurer une cohérence visuelle
    this.flowStateService.recalculateAllNodesPositions();
    
    // 11. Sauvegarder l'état pour l'historique
    this.historyService.saveState();
    
    // 12. Demander une synchronisation des IDs avec délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
      // Exécuter dans la zone Angular pour déclencher la détection de changements
      this.ngZone.run(() => {
        this.foblexIdManager.performSync();
        console.log('Forced ID synchronization after node insertion');
      });
    }, 50);
    
    // 13. Demander une deuxième synchronisation après un délai plus long pour garantir le rendu
    setTimeout(() => {
      this.ngZone.run(() => {
        this.foblexIdManager.performSync();
        console.log('Second ID synchronization to ensure complete rendering');
      });
    }, 300);
  }
}