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

    // CAS SPÉCIAL: Traitement du BinarySplit
    if (nodeType === 'BinarySplit') {
      this.handleBinarySplitDrop(existingConnection, sourceNode, targetNode);
      return;
    }
    
    // CAS SPÉCIAL: Traitement du MultiSplit
    if (nodeType === 'MultiSplit') {
      this.handleMultiSplitDrop(existingConnection, sourceNode, targetNode);
      return;
    }
    
    // Vérifier si nous sommes en train d'insérer un nœud sur une connexion entre un 
    // BinarySplit/MultiSplit et un Exit pour conserver l'alignement vertical
    let shouldAdjustPosition = false;
    
    // Si le nœud source est un BinarySplit ou MultiSplit, nous sommes probablement dans une branche
    if (sourceNode.type === 'BinarySplit' || sourceNode.type === 'MultiSplit') {
      shouldAdjustPosition = true;
    }
    
    // 3. Calculer la position du nouveau nœud - RESPECTER LA GRILLE de 250
    // Forcer 250 unités après la source (au lieu du milieu)
    const newX = sourceNode.position.x + 250;
    
    // IMPORTANT: Pour respecter la position Y de la branche
    // Si on est dans une branche de Split, utiliser la coordonnée Y du nœud cible
    // Sinon, utiliser la coordonnée Y du nœud source
    const newY = shouldAdjustPosition ? targetNode.position.y : sourceNode.position.y;

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
    
    // 7. Repositionner le nœud cible (Target/Exit) ET tous ses descendants
    // Calculer d'abord le déplacement appliqué au nœud cible
    const targetDeltaX = (newX + 250) - targetNode.position.x;
    
    // Fonction pour trouver tous les descendants d'un nœud donné
    const findAllDescendantIds = (nodeId: string, visitedNodes = new Set<string>()): string[] => {
      // Éviter les boucles infinies
      if (visitedNodes.has(nodeId)) return [];
      visitedNodes.add(nodeId);
      
      const childIds: string[] = [];
      
      // Trouver tous les nœuds connectés en sortie directe
      const directConnections = this.flowStateService.connections().filter(conn => {
        const sourceId = conn.sourceId.replace('output_', '');
        return sourceId === nodeId;
      });
      
      // Pour chaque connexion directe, ajouter l'ID cible et ses descendants
      for (const conn of directConnections) {
        const targetId = conn.targetId.replace('input_', '');
        childIds.push(targetId);
        // Appel récursif pour trouver les descendants du nœud enfant
        childIds.push(...findAllDescendantIds(targetId, visitedNodes));
      }
      
      return childIds;
    };
    
    // Trouver tous les descendants du nœud cible
    const descendantIds = findAllDescendantIds(targetNode.id);
    console.log(`Descendants du nœud ${targetNode.type} (id: ${targetNode.id}):`, descendantIds);
    
    // Mettre à jour les positions de tous les nœuds affectés
    const updatedNodes = this.flowStateService.nodes().map(node => {
      // Si c'est le nœud cible directement affecté par l'insertion
      if (node.id === targetNode.id) {
        return {
          ...node,
          position: {
            x: newX + 250, // 250 unités à droite du nouveau nœud
            y: node.position.y // Maintenir la même hauteur
          }
        };
      }
      
      // Si c'est un descendant, appliquer le même déplacement horizontal
      if (descendantIds.includes(node.id)) {
        console.log(`Déplacement du nœud descendant ${node.type} (id: ${node.id}) de ${targetDeltaX} unités`);
        return {
          ...node,
          position: {
            x: node.position.x + targetDeltaX,
            y: node.position.y // Maintenir la même hauteur
          }
        };
      }
      
      return node;
    });
    this.flowStateService.updateNodes(updatedNodes);
    
    // 8. Créer les nouvelles connexions
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

    // 9. Ajouter les nouvelles connexions
    this.flowStateService.addConnection(inputConnection);
    this.flowStateService.addConnection(outputConnection);

    console.log('Added new connections:', inputConnection, outputConnection);
    
    // 10. Vérifier et réparer l'état si nécessaire
    const wasRepaired = this.flowStateService.validateAndRepairState();
    if (wasRepaired) {
      console.log('State was repaired during drop operation');
    }

    // 11. IMPORTANT: NE PAS recalculer les positions pour ne pas perdre notre positionnement spécifique
    // this.flowStateService.recalculateAllNodesPositions();
    
    // 12. Sauvegarder l'état pour l'historique
    this.historyService.saveState();
    
    // 13. Effectuer une synchronisation immédiate pour assurer la mise à jour visuelle
    this.foblexIdManager.performSync();
    
    // 14. Demander une synchronisation des IDs avec délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
      // Exécuter dans la zone Angular pour déclencher la détection de changements
      this.ngZone.run(() => {
        this.foblexIdManager.performSync();
        console.log('Forced ID synchronization after node insertion');
      });
    }, 50);
    
    // 15. Demander une deuxième synchronisation après un délai plus long pour garantir le rendu
    setTimeout(() => {
      this.ngZone.run(() => {
        this.foblexIdManager.performSync();
        console.log('Second ID synchronization to ensure complete rendering');
      });
    }, 300);
  }

  /**
   * Gère spécifiquement le drop d'un BinarySplit sur une connexion existante
   * Crée automatiquement une deuxième branche avec un nouveau nœud Exit
   * @param existingConnection La connexion existante
   * @param sourceNode Le nœud source
   * @param targetNode Le nœud cible (généralement un Exit)
   */
  private handleBinarySplitDrop(
    existingConnection: Connection, 
    sourceNode: CrmNode, 
    targetNode: CrmNode
  ): void {
    console.log('Handling special case: BinarySplit drop');
    
    // 1. Calculer la position du nouveau BinarySplit - RESPECTER LA GRILLE de 250
    // Au lieu de calculer la position entre source et cible, forcer 250 unités après la source
    const splitX = sourceNode.position.x + 250;
    const splitY = sourceNode.position.y;
    
    // 2. Créer le nœud BinarySplit
    const binarySplitNode: CrmNode = {
      id: generateGuid(),
      type: 'BinarySplit',
      text: 'BinarySplit',
      position: { x: splitX, y: splitY },
      maxInputs: 1,
      maxOutputs: 2
    };
    
    // 3. Calculer les décalages pour le positionnement des nœuds Exit
    const verticalOffset = 150;
    // Décalage horizontal: forcer les Exit à +250 du BinarySplit (soit +500 de l'Audience)
    const exitX = splitX + 250;
    
    // 4. Créer un nouveau nœud Exit pour la branche du HAUT
    const newExitNode: CrmNode = {
      id: generateGuid(),
      type: 'Exit',
      text: 'Fin du parcours',
      position: { 
        x: exitX,
        y: splitY - verticalOffset // Positionner AU-DESSUS du BinarySplit
      },
      maxInputs: 1,
      maxOutputs: 0
    };
    
    // 5. Supprimer l'ancienne connexion
    this.flowStateService.removeConnection(existingConnection.id);
    
    // 6. Ajouter le nouveau nœud BinarySplit
    this.flowStateService.addNode(binarySplitNode);
    
    // 7. Mettre à jour la position de l'Exit existant 
    const currentNodes = this.flowStateService.nodes().map(node => {
      // Si c'est le nœud cible (Exit existant), on met à jour sa position
      if (node.id === targetNode.id) {
        return {
          ...node,
          position: {
            x: exitX,
            y: splitY + verticalOffset
          }
        };
      }
      return node;
    });
    
    // 8. Ajouter le nouvel Exit après la mise à jour des nœuds existants
    this.flowStateService.updateNodes(currentNodes);
    this.flowStateService.addNode(newExitNode);
    
    // 9. Créer et ajouter la connexion de la source au BinarySplit
    const sourceToBinarySplit: Connection = {
      id: generateGuid(),
      sourceId: existingConnection.sourceId,
      targetId: `input_${binarySplitNode.id}`
    };
    this.flowStateService.addConnection(sourceToBinarySplit);
    
    // 10. Créer et ajouter la connexion du BinarySplit vers l'Exit du HAUT
    const binarySplitToNewExit: Connection = {
      id: generateGuid(),
      sourceId: `output_${binarySplitNode.id}`,
      targetId: `input_${newExitNode.id}`
    };
    this.flowStateService.addConnection(binarySplitToNewExit);
    
    // 11. Créer et ajouter la connexion du BinarySplit vers l'Exit du BAS (le nœud Exit existant)
    const binarySplitToExisting: Connection = {
      id: generateGuid(),
      sourceId: `output_${binarySplitNode.id}`,
      targetId: existingConnection.targetId
    };
    this.flowStateService.addConnection(binarySplitToExisting);
    
    console.log('Added BinarySplit with Exit above and below');
    
    // 12. Vérifier et réparer l'état si nécessaire
    const wasRepaired = this.flowStateService.validateAndRepairState();
    if (wasRepaired) {
      console.log('State was repaired during BinarySplit drop operation');
    }
    
    // 13. IMPORTANT: NE PAS recalculer les positions pour ne pas perdre notre positionnement spécifique
    // Ne pas utiliser recalculateAllNodesPositions() car cela perturberait notre grille personnalisée
    
    // 14. Sauvegarder l'état pour l'historique
    this.historyService.saveState();
    
    // 15. Effectuer une synchronisation immédiate pour assurer la mise à jour visuelle
    this.foblexIdManager.performSync();
    
    // 16. Demander une synchronisation des IDs avec délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
      this.ngZone.run(() => {
        this.foblexIdManager.performSync();
        console.log('Forced ID synchronization after BinarySplit insertion');
      });
    }, 50);
    
    // 17. Demander une deuxième synchronisation après un délai plus long
    setTimeout(() => {
      this.ngZone.run(() => {
        this.foblexIdManager.performSync();
        console.log('Second ID synchronization for BinarySplit operation');
      });
    }, 300);
  }

  /**
   * Gère spécifiquement le drop d'un MultiSplit sur une connexion existante
   * Crée automatiquement trois branches sortantes chacune avec un nœud Exit
   * @param existingConnection La connexion existante
   * @param sourceNode Le nœud source
   * @param targetNode Le nœud cible (généralement un Exit)
   */
  private handleMultiSplitDrop(
    existingConnection: Connection, 
    sourceNode: CrmNode, 
    targetNode: CrmNode
  ): void {
    console.log('Handling special case: MultiSplit drop');
    
    // 1. Calculer la position du nouveau MultiSplit - RESPECTER LA GRILLE de 250
    // Forcer 250 unités après la source
    const splitX = sourceNode.position.x + 250;
    const splitY = sourceNode.position.y;
    
    // 2. Créer le nœud MultiSplit
    const multiSplitNode: CrmNode = {
      id: generateGuid(),
      type: 'MultiSplit',
      text: 'MultiSplit',
      position: { x: splitX, y: splitY },
      maxInputs: 1,
      maxOutputs: 3
    };
    
    // 3. Calculer les décalages pour le positionnement des nœuds Exit
    const verticalOffset = 150;
    // Décalage horizontal: forcer les Exit à +250 du MultiSplit (soit +500 de l'Audience)
    const exitX = splitX + 250;
    
    // 4. Créer les trois nouveaux nœuds Exit pour les trois branches
    const newExitNodes: CrmNode[] = [
      {
        id: generateGuid(),
        type: 'Exit',
        text: 'Fin du parcours',
        position: { 
          x: exitX, 
          y: splitY - verticalOffset // Positionner AU-DESSUS du MultiSplit
        },
        maxInputs: 1,
        maxOutputs: 0
      },
      {
        id: generateGuid(),
        type: 'Exit',
        text: 'Fin du parcours',
        position: { 
          x: exitX, 
          y: splitY // Même niveau que le MultiSplit
        },
        maxInputs: 1,
        maxOutputs: 0
      },
      {
        id: generateGuid(),
        type: 'Exit',
        text: 'Fin du parcours',
        position: { 
          x: exitX, 
          y: splitY + verticalOffset // Positionner SOUS le MultiSplit
        },
        maxInputs: 1,
        maxOutputs: 0
      }
    ];
    
    // 5. Supprimer l'ancienne connexion
    this.flowStateService.removeConnection(existingConnection.id);
    
    // 6. Ajouter le MultiSplit
    this.flowStateService.addNode(multiSplitNode);
    
    // 7. Mettre à jour la position du nœud Exit existant en le remplaçant par un nouveau
    // Créer une copie complète de tous les nœuds
    const currentNodes = this.flowStateService.nodes().map(node => node);
    
    // 8. Supprimer l'Exit existant qui ne sera plus utilisé
    const filteredNodes = currentNodes.filter(node => node.id !== targetNode.id);
    this.flowStateService.updateNodes(filteredNodes);
    
    // 9. Ajouter tous les nouveaux nœuds Exit
    for (const exitNode of newExitNodes) {
      this.flowStateService.addNode(exitNode);
    }
    
    // 10. Créer et ajouter la connexion de la source au MultiSplit
    const sourceToMultiSplit: Connection = {
      id: generateGuid(),
      sourceId: existingConnection.sourceId,
      targetId: `input_${multiSplitNode.id}`
    };
    this.flowStateService.addConnection(sourceToMultiSplit);
    
    // 11. Créer et ajouter les connexions du MultiSplit vers les Exits
    for (const exitNode of newExitNodes) {
      const connection: Connection = {
        id: generateGuid(),
        sourceId: `output_${multiSplitNode.id}`,
        targetId: `input_${exitNode.id}`
      };
      this.flowStateService.addConnection(connection);
    }
    
    console.log('Added MultiSplit with three branches to Exits');
    
    // 12. Vérifier et réparer l'état si nécessaire
    const wasRepaired = this.flowStateService.validateAndRepairState();
    if (wasRepaired) {
      console.log('State was repaired during MultiSplit drop operation');
    }
    
    // 13. IMPORTANT: NE PAS recalculer les positions pour ne pas perdre notre positionnement spécifique
    // this.flowStateService.recalculateAllNodesPositions();
    
    // 14. Sauvegarder l'état pour l'historique
    this.historyService.saveState();
    
    // 15. Effectuer une synchronisation immédiate pour assurer la mise à jour visuelle
    this.foblexIdManager.performSync();
    
    // 16. Demander une synchronisation des IDs avec délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
      this.ngZone.run(() => {
        this.foblexIdManager.performSync();
        console.log('Forced ID synchronization after MultiSplit insertion');
      });
    }, 50);
    
    // 17. Demander une deuxième synchronisation après un délai plus long
    setTimeout(() => {
      this.ngZone.run(() => {
        this.foblexIdManager.performSync();
        console.log('Second ID synchronization for MultiSplit operation');
      });
    }, 300);
  }
}