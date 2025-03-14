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
    
    // 1. Calculer la position X du nouveau BinarySplit (250 unités après le nœud source)
    const newX = sourceNode.position.x + 250;
    
    // 2. Calculer la position Y du BinarySplit (même Y que le nœud cible)
    const newY = targetNode.position.y;
    
    console.log(`BinarySplit will be placed at X=${newX}, Y=${newY}`, {
      sourceNodePosition: sourceNode.position,
      targetNodePosition: targetNode.position
    });
    
    // 3. Identifier le niveau d'imbrication actuel (avant d'ajouter le nouveau)
    const currentBinarySplitLevel = this.calculateBinarySplitLevel(sourceNode.id);
    console.log(`Current BinarySplit level before adding new one: ${currentBinarySplitLevel}`);
    
    // 4. IMPORTANT: Recalculer les positions de tous les nœuds existants
    // Doubler l'offset de tous les BinarySplits existants pour faire de la place
    this.recalculateAllBinarySplitPositions(currentBinarySplitLevel + 1);
    
    // 5. Créer le nœud BinarySplit
    const binarySplitNode: CrmNode = {
      id: generateGuid(),
      type: 'BinarySplit',
      text: 'BinarySplit',
      position: { x: newX, y: newY },
      maxInputs: this.flowStateService.getDefaultMaxInputs('BinarySplit'),
      maxOutputs: this.flowStateService.getDefaultMaxOutputs('BinarySplit')
    };
    
    // 6. Calculer l'offset pour ce nouveau BinarySplit (offset de base, car tous les autres ont été ajustés)
    const baseOffset = 125;
    
    console.log(`Using base offset for new BinarySplit: ${baseOffset}`);
    
    // 7. Créer les deux nœuds Exit pour les branches
    const exitNodeHigh: CrmNode = {
      id: generateGuid(),
      type: 'Exit',
      text: 'Exit High',
      position: { 
        x: newX + 250,
        y: newY + baseOffset // Branche haute
      },
      maxInputs: this.flowStateService.getDefaultMaxInputs('Exit'),
      maxOutputs: this.flowStateService.getDefaultMaxOutputs('Exit')
    };
    
    const exitNodeLow: CrmNode = {
      id: generateGuid(),
      type: 'Exit',
      text: 'Exit Low',
      position: { 
        x: newX + 250,
        y: newY - baseOffset // Branche basse
      },
      maxInputs: this.flowStateService.getDefaultMaxInputs('Exit'),
      maxOutputs: this.flowStateService.getDefaultMaxOutputs('Exit')
    };
    
    console.log(`Exit nodes will be placed at High(${exitNodeHigh.position.x}, ${exitNodeHigh.position.y}) and Low(${exitNodeLow.position.x}, ${exitNodeLow.position.y})`);
    
    // 8. Supprimer l'ancienne connexion
    this.flowStateService.removeConnection(existingConnection.id);
    
    // 9. Ajouter les nouveaux nœuds
    this.flowStateService.addNode(binarySplitNode);
    this.flowStateService.addNode(exitNodeHigh);
    this.flowStateService.addNode(exitNodeLow);
    
    // 10. Créer les nouvelles connexions
    const inputConnection: Connection = {
      id: generateGuid(),
      sourceId: existingConnection.sourceId,
      targetId: `input_${binarySplitNode.id}`
    };
    
    const outputConnectionHigh: Connection = {
      id: generateGuid(),
      sourceId: `output_${binarySplitNode.id}`,
      targetId: `input_${exitNodeHigh.id}`
    };
    
    const outputConnectionLow: Connection = {
      id: generateGuid(),
      sourceId: `output_${binarySplitNode.id}`,
      targetId: `input_${exitNodeLow.id}`
    };
    
    // 11. Ajouter les nouvelles connexions
    this.flowStateService.addConnection(inputConnection);
    this.flowStateService.addConnection(outputConnectionHigh);
    this.flowStateService.addConnection(outputConnectionLow);
    
    // 12. Si le nœud cible était connecté à d'autres nœuds, les rediriger vers les nouveaux Exit nodes
    const existingTargetOutputConnections = this.flowStateService.connections().filter(
      conn => conn.sourceId === `output_${targetNode.id}`
    );
    
    // Si des connexions sortantes existent, les redistribuer entre les deux branches
    if (existingTargetOutputConnections.length > 0) {
      console.log(`Found ${existingTargetOutputConnections.length} outgoing connections from target node`);
      
      // Supprimer les connexions existantes
      existingTargetOutputConnections.forEach(conn => {
        this.flowStateService.removeConnection(conn.id);
      });
      
      // Créer de nouvelles connexions à partir du nœud Exit haut
      // (on pourrait implémenter une logique plus sophistiquée pour répartir entre haut et bas)
      existingTargetOutputConnections.forEach(conn => {
        const newConn: Connection = {
          id: generateGuid(),
          sourceId: `output_${exitNodeHigh.id}`,
          targetId: conn.targetId
        };
        this.flowStateService.addConnection(newConn);
      });
    }
    
    // 13. Supprimer le nœud cible original si c'était un Exit
    // Cela évite d'avoir des nœuds orphelins déconnectés
    if (targetNode.type === 'Exit') {
      this.flowStateService.removeNode(targetNode.id);
      console.log(`Removed original Exit node ${targetNode.id}`);
    }
    
    // Log de l'état pour vérification
    console.log('Current state after BinarySplit drop:', {
      nodes: this.flowStateService.nodes(),
      connections: this.flowStateService.connections()
    });
    
    // 14. Vérifier et réparer l'état si nécessaire
    const wasRepaired = this.flowStateService.validateAndRepairState();
    if (wasRepaired) {
      console.log('State was repaired during BinarySplit drop');
    }
    
    // 15. Sauvegarder l'état pour l'historique
    this.historyService.saveState();
    
    // 16. Synchroniser les IDs
    this.foblexIdManager.performSync();
    
    // 17. Demander une synchronisation des IDs avec délai
    setTimeout(() => {
      this.ngZone.run(() => {
        this.foblexIdManager.performSync();
        console.log('Forced ID synchronization after BinarySplit insertion');
      });
    }, 50);
  }

  /**
   * Recalcule les positions de tous les noeuds BinarySplit et leurs descendants
   * en doublant les offsets pour éviter les chevauchements quand un nouveau niveau est ajouté
   * @param newMaxLevel Le nouveau niveau maximum après l'ajout du BinarySplit
   */
  private recalculateAllBinarySplitPositions(newMaxLevel: number): void {
    console.log(`Recalculating all BinarySplit positions for new max level: ${newMaxLevel}`);
    
    // 1. Trouver tous les BinarySplits et leurs branches
    const allNodes = this.flowStateService.nodes();
    const allConnections = this.flowStateService.connections();
    
    // 2. Construire un arbre représentant la structure complète
    // Créer une map des nœuds par ID
    const nodesById = new Map(allNodes.map(node => [node.id, { ...node, children: [] as string[] }]));
    
    // 3. Ajouter les relations parent-enfant
    allConnections.forEach(conn => {
      const sourceId = conn.sourceId.replace('output_', '');
      const targetId = conn.targetId.replace('input_', '');
      
      if (nodesById.has(sourceId) && nodesById.has(targetId)) {
        const nodeWithChildren = nodesById.get(sourceId)!;
        nodeWithChildren.children.push(targetId);
      }
    });
    
    // 4. Trouver tous les BinarySplits
    const binarySplitNodes = Array.from(nodesById.values()).filter(node => node.type === 'BinarySplit');
    console.log(`Found ${binarySplitNodes.length} BinarySplit nodes to recalculate`);
    
    // 5. Calculer le niveau de chaque BinarySplit
    const nodeLevels = new Map<string, number>();
    
    // Fonction récursive pour déterminer les niveaux
    const determineNodeLevel = (nodeId: string, visited = new Set<string>()): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);
      
      // Si déjà calculé, retourner le niveau
      if (nodeLevels.has(nodeId)) return nodeLevels.get(nodeId)!;
      
      const node = nodesById.get(nodeId);
      if (!node) return 0;
      
      // Trouver tous les parents (nœuds qui ont ce nœud comme enfant)
      const parents = Array.from(nodesById.values()).filter(n => 
        n.children.includes(nodeId)
      );
      
      if (parents.length === 0) {
        // Nœud racine, niveau 0
        nodeLevels.set(nodeId, 0);
        return 0;
      } else {
        // Le niveau est le niveau maximum des parents + 1 si c'est un BinarySplit
        const parentLevels = parents.map(p => determineNodeLevel(p.id, visited));
        const maxParentLevel = Math.max(...parentLevels);
        
        // Si c'est un BinarySplit, incrémenter le niveau
        const nodeLevel = node.type === 'BinarySplit' ? maxParentLevel + 1 : maxParentLevel;
        nodeLevels.set(nodeId, nodeLevel);
        return nodeLevel;
      }
    };
    
    // Calculer les niveaux de tous les nœuds
    allNodes.forEach(node => {
      determineNodeLevel(node.id);
    });
    
    // 6. Calculer les nouveaux offsets pour chaque niveau
    // Niveau 0 = pas d'offset
    // Niveau 1 = offset de base * 2^(newMaxLevel-1)
    // Niveau 2 = offset de base * 2^(newMaxLevel-2)
    // etc.
    const baseOffset = 125;
    const levelOffsets = new Map<number, number>();
    
    for (let level = 1; level <= newMaxLevel; level++) {
      const powerFactor = newMaxLevel - level;
      const offset = baseOffset * Math.pow(2, powerFactor);
      levelOffsets.set(level, offset);
      console.log(`Level ${level} gets offset ${offset}`);
    }
    
    // 7. Mettre à jour les positions des nœuds
    const updatedNodes: CrmNode[] = [];
    
    allNodes.forEach(originalNode => {
      // Clone du nœud original
      const node = { ...originalNode };
      
      // Conserver la position X et mettre à jour uniquement Y si nécessaire
      // Trouver le parent BinarySplit de ce nœud
      const parents = Array.from(nodesById.values()).filter(n => 
        n.children.includes(node.id) && n.type === 'BinarySplit'
      );
      
      if (parents.length > 0) {
        // Ce nœud est un enfant d'un BinarySplit
        const parent = parents[0];
        const parentNode = allNodes.find(n => n.id === parent.id);
        
        if (parentNode) {
          const parentLevel = nodeLevels.get(parent.id) || 0;
          const offset = levelOffsets.get(parentLevel) || baseOffset;
          
          // Déterminer si c'est la branche haute ou basse du BinarySplit
          // Chercher toutes les connexions sortantes du parent
          const parentOutConnections = allConnections.filter(conn => 
            conn.sourceId === `output_${parent.id}`
          );
          
          // Généralement la première connexion est la branche haute, la seconde est la branche basse
          // Mais nous pouvons aussi vérifier la position Y relative
          if (parentOutConnections.length >= 2) {
            const highBranchConnectionId = parentOutConnections[0].id;
            const lowBranchConnectionId = parentOutConnections[1].id;
            
            const isHighBranch = allConnections.some(conn => 
              conn.id === highBranchConnectionId && conn.targetId === `input_${node.id}`
            );
            
            const isLowBranch = allConnections.some(conn => 
              conn.id === lowBranchConnectionId && conn.targetId === `input_${node.id}`
            );
            
            if (isHighBranch) {
              // Branche haute
              node.position.y = parentNode.position.y + offset;
              console.log(`Node ${node.id} (${node.type}) is on HIGH branch of BinarySplit ${parent.id}, updating Y to ${node.position.y}`);
            } else if (isLowBranch) {
              // Branche basse
              node.position.y = parentNode.position.y - offset;
              console.log(`Node ${node.id} (${node.type}) is on LOW branch of BinarySplit ${parent.id}, updating Y to ${node.position.y}`);
            } else {
              // Connexion non standard, utiliser la position Y relative
              const yDiff = node.position.y - parentNode.position.y;
              const direction = Math.sign(yDiff); // 1 pour haut, -1 pour bas
              node.position.y = parentNode.position.y + (direction * offset);
              console.log(`Node ${node.id} (${node.type}) has non-standard connection to BinarySplit ${parent.id}, updating Y to ${node.position.y}`);
            }
          }
        }
      }
      
      updatedNodes.push(node);
    });
    
    // 8. Mettre à jour l'état avec les nouvelles positions
    this.flowStateService.updateNodes(updatedNodes);
    console.log('Updated node positions to avoid overlapping at deeper levels');
  }

  /**
   * Calcule le niveau d'imbrication des BinarySplit pour un nœud donné
   * 0 = racine, 1 = premier niveau de BinarySplit, etc.
   * @param nodeId ID du nœud pour lequel calculer le niveau
   * @returns Le niveau d'imbrication (0, 1, 2, etc.)
   */
  private calculateBinarySplitLevel(nodeId: string): number {
    // Tableaux pour stocker les chemins d'ancêtres et éviter les boucles
    const ancestorPaths: {nodeId: string, type: string}[] = [];
    const visited = new Set<string>();
    
    // Fonction récursive pour parcourir les ancêtres
    const traverseAncestors = (currentNodeId: string): void => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      
      const node = this.flowStateService.nodes().find(n => n.id === currentNodeId);
      if (!node) return;
      
      ancestorPaths.push({nodeId: currentNodeId, type: node.type});
      
      // Trouver les connexions entrantes
      const incomingConnections = this.flowStateService.connections().filter(conn => 
        conn.targetId === `input_${currentNodeId}`
      );
      
      for (const conn of incomingConnections) {
        const parentId = conn.sourceId.replace('output_', '');
        traverseAncestors(parentId);
      }
    };
    
    // Commencer la traversée
    traverseAncestors(nodeId);
    
    // Compter les BinarySplit dans le chemin
    const binarySplitCount = ancestorPaths.filter(node => node.type === 'BinarySplit').length;
    
    console.log(`BinarySplit level for node ${nodeId}: ${binarySplitCount}`);
    console.log('Ancestor path:', ancestorPaths.map(a => `${a.nodeId} (${a.type})`).join(' -> '));
    
    return binarySplitCount;
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
    
  
  }
}