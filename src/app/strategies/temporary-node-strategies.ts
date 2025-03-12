import { CrmNode, Connection } from '../models/crm.models';
import { FlowStateService } from '../services/flow-state.service';
import { generateGuid } from '@foblex/utils';

/**
 * Interface améliorée pour les stratégies de création de nœuds temporaires
 * qui utilise directement le service centralisé
 */
export interface CentralizedTemporaryNodeStrategy {
  /**
   * Vérifie si cette stratégie peut être appliquée pour ce nœud
   * @param node Le nœud existant
   * @param existingOutputConnections Les connexions de sortie existantes
   * @param existingInputConnections Les connexions d'entrée existantes
   * @param itemType Le type d'élément en cours de drag
   */
  canApply(
    node: CrmNode, 
    existingOutputConnections: Connection[], 
    existingInputConnections: Connection[],
    itemType: string
  ): boolean;
  
  /**
   * Crée des nœuds temporaires autour d'un nœud existant en utilisant le service centralisé
   * @param node Le nœud existant
   * @param existingOutputConnections Les connexions de sortie existantes
   * @param existingInputConnections Les connexions d'entrée existantes
   * @param itemType Le type d'élément en cours de drag
   * @param flowStateService Service centralisé pour la gestion de l'état
   * @returns Le nombre de nœuds temporaires créés
   */
  createTemporaryNodes(
    node: CrmNode,
    existingOutputConnections: Connection[],
    existingInputConnections: Connection[],
    itemType: string,
    flowStateService: FlowStateService
  ): number;
}

/**
 * Stratégie standard pour la création de nœuds temporaires
 */
export class StandardNodeStrategy implements CentralizedTemporaryNodeStrategy {
  canApply(
    node: CrmNode,
    existingOutputConnections: Connection[],
    existingInputConnections: Connection[],
    itemType: string
  ): boolean {
    // Cette stratégie s'applique à tous les nœuds standard (autres que spéciaux)
    return node.type !== 'BinarySplit' && node.type !== 'MultiSplit';
  }
  
  createTemporaryNodes(
    node: CrmNode,
    existingOutputConnections: Connection[],
    existingInputConnections: Connection[],
    itemType: string,
    flowStateService: FlowStateService
  ): number {
    let createdNodesCount = 0;
    
    // Vérifier si le nœud existant peut accepter plus de connexions
    const canAcceptMoreOutputs = node.maxOutputs === undefined || 
      existingOutputConnections.length < node.maxOutputs;
      
    const canAcceptMoreInputs = node.maxInputs === undefined || 
      existingInputConnections.length < node.maxInputs;
    
    // Obtenir les limites du type de nœud en cours de drag
    const maxInputsForType = flowStateService.getDefaultMaxInputs(itemType);
    const maxOutputsForType = flowStateService.getDefaultMaxOutputs(itemType);
    
    // Vérifier si le nœud du type dragué peut avoir des entrées
    const newNodeCanHaveInputs = maxInputsForType > 0;
    
    console.log(`StandardNodeStrategy - Node ${node.id} (${node.type}):
      - Can accept more outputs: ${canAcceptMoreOutputs}
      - Can accept more inputs: ${canAcceptMoreInputs}
      - New node can have inputs: ${newNodeCanHaveInputs}
      - New node can have outputs: ${maxOutputsForType > 0}
      - Max inputs for type ${itemType}: ${maxInputsForType}
      - Max outputs for type ${itemType}: ${maxOutputsForType}`);
    
    // Créer un nœud temporaire à droite du nœud existant (le nœud existant -> nouveau nœud)
    if (canAcceptMoreOutputs && newNodeCanHaveInputs) {
      // Vérifier si le type de nœud existant et le type à créer sont compatibles
      // Par exemple, pour les types de communication qui ne peuvent avoir qu'1 entrée et 1 sortie
      const existingTypeMaxOutputs = flowStateService.getDefaultMaxOutputs(node.type);
      if (existingTypeMaxOutputs > 0) {
        const rightNodePosition = { 
          x: node.position.x + 250, 
          y: node.position.y 
        };
        
        // Vérifier que les positions ne se superposent pas
        if (flowStateService.isPositionFree(rightNodePosition)) {
          // Créer le nœud temporaire via le service centralisé
          const rightTempNode = flowStateService.createTemporaryNode({
            id: generateGuid(),
            type: itemType,
            text: `${itemType} (Drop here to connect)`,
            position: rightNodePosition,
            maxInputs: maxInputsForType,
            maxOutputs: maxOutputsForType
          });
          
          // Créer une connexion temporaire via le service centralisé
          flowStateService.createTemporaryConnection({
            id: generateGuid(),
            sourceId: `output_${node.id}`,
            targetId: `input_${rightTempNode.id}`
          });
          
          createdNodesCount++;
        }
      }
    }
    
    // Vérifier si le nœud du type dragué peut avoir des sorties
    const newNodeCanHaveOutputs = maxOutputsForType > 0;
    
    // Créer un nœud temporaire en dessous du nœud existant (nouveau nœud -> nœud existant)
    if (canAcceptMoreInputs && newNodeCanHaveOutputs) {
      // Vérifier si le type de nœud existant et le type à créer sont compatibles
      const existingTypeMaxInputs = flowStateService.getDefaultMaxInputs(node.type);
      if (existingTypeMaxInputs > 0) {
        const bottomNodePosition = { 
          x: node.position.x, 
          y: node.position.y + 200
        };

        // Vérifier que les positions ne se superposent pas
        if (flowStateService.isPositionFree(bottomNodePosition)) {
          // Créer le nœud temporaire via le service centralisé
          const bottomTempNode = flowStateService.createTemporaryNode({
            id: generateGuid(),
            type: itemType,
            text: `${itemType} (Drop here to connect)`,
            position: bottomNodePosition,
            maxInputs: maxInputsForType,
            maxOutputs: maxOutputsForType
          });
          
          // Créer une connexion temporaire via le service centralisé
          flowStateService.createTemporaryConnection({
            id: generateGuid(),
            sourceId: `output_${bottomTempNode.id}`,
            targetId: `input_${node.id}`
          });
          
          createdNodesCount++;
        }
      }
    }
    
    return createdNodesCount;
  }
}

/**
 * Stratégie pour la création de nœuds temporaires autour d'un BinarySplit
 */
export class BinarySplitStrategy implements CentralizedTemporaryNodeStrategy {
  constructor(private getAllNodes: () => CrmNode[]) {}

  canApply(
    node: CrmNode,
    existingOutputConnections: Connection[],
    existingInputConnections: Connection[],
    itemType: string
  ): boolean {
    return node.type === 'BinarySplit';
  }
  
  createTemporaryNodes(
    node: CrmNode,
    existingOutputConnections: Connection[],
    existingInputConnections: Connection[],
    itemType: string,
    flowStateService: FlowStateService
  ): number {
    let createdNodesCount = 0;
    
    // Pour un BinarySplit, autoriser l'ajout de connections si moins de 2 sorties
    const canAcceptMoreOutputs = existingOutputConnections.length < 2;
    const canAcceptMoreInputs = existingInputConnections.length < 1;
    
    // Vérifier si le nœud du type dragué peut avoir des entrées
    const newNodeCanHaveInputs = flowStateService.getDefaultMaxInputs(itemType) > 0;
    
    if (canAcceptMoreOutputs && newNodeCanHaveInputs) {
      // Positions horizontales avec espacement vers le haut et le bas
      // Calculer des positions pour les deux sorties du BinarySplit
      const horizontalOffset = 350;
      const verticalOffset = 120;
      const positions = [
        { // Position en haut à droite (plus espacée)
          x: node.position.x + horizontalOffset,
          y: node.position.y - verticalOffset
        },
        { // Position en bas à droite (plus espacée)
          x: node.position.x + horizontalOffset,
          y: node.position.y + verticalOffset
        }
      ];
      
      // Filtrer les positions déjà occupées par des connexions existantes
      const usedPositionIndices = new Set<number>();
      for (const conn of existingOutputConnections) {
        // Trouver le nœud cible connecté
        const targetNodeId = conn.targetId.replace('input_', '');
        const targetNode = this.findConnectedNode(targetNodeId);
        
        if (targetNode) {
          // Déterminer quelle position est occupée (approximativement)
          if (Math.abs(targetNode.position.y - positions[0].y) < 
              Math.abs(targetNode.position.y - positions[1].y)) {
            usedPositionIndices.add(0); // La position en haut est utilisée
          } else {
            usedPositionIndices.add(1); // La position en bas est utilisée
          }
        }
      }
      
      // Créer des nœuds temporaires pour les positions disponibles
      for (let i = 0; i < positions.length; i++) {
        if (!usedPositionIndices.has(i) && flowStateService.isPositionFree(positions[i])) {
          // Créer le nœud temporaire via le service centralisé
          const binarySplitTempNode = flowStateService.createTemporaryNode({
            id: generateGuid(),
            type: itemType,
            text: `${itemType} (Branche ${i === 0 ? 'supérieure' : 'inférieure'})`,
            position: positions[i],
            maxInputs: flowStateService.getDefaultMaxInputs(itemType),
            maxOutputs: flowStateService.getDefaultMaxOutputs(itemType)
          });
          
          // Créer une connexion temporaire via le service centralisé
          flowStateService.createTemporaryConnection({
            id: generateGuid(),
            sourceId: `output_${node.id}`,
            targetId: `input_${binarySplitTempNode.id}`
          });
          
          createdNodesCount++;
        }
      }
    }
    
    // Le reste de la logique standard pour l'entrée du BinarySplit
    const newNodeCanHaveOutputs = flowStateService.getDefaultMaxOutputs(itemType) > 0;
    
    if (canAcceptMoreInputs && newNodeCanHaveOutputs) {
      const inputNodePosition = { 
        x: node.position.x - 350,
        y: node.position.y
      };
      
      // Vérifier que les positions ne se superposent pas
      if (flowStateService.isPositionFree(inputNodePosition)) {
        // Créer le nœud temporaire via le service centralisé
        const inputTempNode = flowStateService.createTemporaryNode({
          id: generateGuid(),
          type: itemType,
          text: `${itemType} (Connexion à l'entrée)`,
          position: inputNodePosition,
          maxInputs: flowStateService.getDefaultMaxInputs(itemType),
          maxOutputs: flowStateService.getDefaultMaxOutputs(itemType)
        });
        
        // Créer une connexion temporaire via le service centralisé
        flowStateService.createTemporaryConnection({
          id: generateGuid(),
          sourceId: `output_${inputTempNode.id}`,
          targetId: `input_${node.id}`
        });
        
        createdNodesCount++;
      }
    }
    
    return createdNodesCount;
  }
  
  /**
   * Trouve un nœud connecté par son ID
   * @param nodeId ID du nœud à trouver
   * @returns Le nœud trouvé ou undefined
   * @private
   */
  private findConnectedNode(nodeId: string): CrmNode | undefined {
    return this.getAllNodes().find(n => n.id === nodeId);
  }
}

/**
 * Stratégie pour la création de nœuds temporaires autour d'un MultiSplit
 */
export class MultiSplitStrategy implements CentralizedTemporaryNodeStrategy {
  constructor(private getAllNodes: () => CrmNode[]) {}

  canApply(
    node: CrmNode,
    existingOutputConnections: Connection[],
    existingInputConnections: Connection[],
    itemType: string
  ): boolean {
    return node.type === 'MultiSplit';
  }
  
  createTemporaryNodes(
    node: CrmNode,
    existingOutputConnections: Connection[],
    existingInputConnections: Connection[],
    itemType: string,
    flowStateService: FlowStateService
  ): number {
    let createdNodesCount = 0;
    
    // Pour un MultiSplit, le nombre de sorties peut être illimité
    const canAcceptMoreOutputs = true;
    const canAcceptMoreInputs = existingInputConnections.length < 1;
    
    // Vérifier si le nœud du type dragué peut avoir des entrées
    const newNodeCanHaveInputs = flowStateService.getDefaultMaxInputs(itemType) > 0;
    
    if (canAcceptMoreOutputs && newNodeCanHaveInputs) {
      // Pour le MultiSplit, positionner les nœuds en éventail à droite
      // Obtenir les positions des connexions existantes
      const connectedNodePositions = existingOutputConnections
        .map(conn => {
          const targetNodeId = conn.targetId.replace('input_', '');
          return this.findConnectedNode(targetNodeId);
        })
        .filter((n): n is CrmNode => n !== undefined)
        .map(n => n.position.y);
      
      // Créer un nœud temporaire à droite, trouver un espace libre
      const horizontalOffset = 350;
      
      // Calculer la position Y optimale (éviter les nœuds existants)
      let optimalY = node.position.y;
      const minSpace = 150; // Espace minimum entre les nœuds
      
      // Si la position par défaut est trop proche d'un nœud existant,
      // chercher une position plus libre
      if (connectedNodePositions.some(y => Math.abs(y - optimalY) < minSpace)) {
        // Essayer des positions vers le haut et vers le bas jusqu'à trouver un espace
        for (let offset = minSpace; offset <= 500; offset += minSpace) {
          // Essayer au-dessus
          const topY = node.position.y - offset;
          if (!connectedNodePositions.some(y => Math.abs(y - topY) < minSpace)) {
            optimalY = topY;
            break;
          }
          
          // Essayer en-dessous
          const bottomY = node.position.y + offset;
          if (!connectedNodePositions.some(y => Math.abs(y - bottomY) < minSpace)) {
            optimalY = bottomY;
            break;
          }
        }
      }
      
      const multiSplitNodePosition = {
        x: node.position.x + horizontalOffset,
        y: optimalY
      };
      
      // Vérifier que les positions ne se superposent pas
      if (flowStateService.isPositionFree(multiSplitNodePosition)) {
        // Créer le nœud temporaire via le service centralisé
        const multiSplitTempNode = flowStateService.createTemporaryNode({
          id: generateGuid(),
          type: itemType,
          text: `${itemType} (Nouvelle branche)`,
          position: multiSplitNodePosition,
          maxInputs: flowStateService.getDefaultMaxInputs(itemType),
          maxOutputs: flowStateService.getDefaultMaxOutputs(itemType)
        });
        
        // Créer une connexion temporaire via le service centralisé
        flowStateService.createTemporaryConnection({
          id: generateGuid(),
          sourceId: `output_${node.id}`,
          targetId: `input_${multiSplitTempNode.id}`
        });
        
        createdNodesCount++;
      }
    }
    
    // Le reste de la logique standard pour l'entrée du MultiSplit
    const newNodeCanHaveOutputs = flowStateService.getDefaultMaxOutputs(itemType) > 0;
    
    if (canAcceptMoreInputs && newNodeCanHaveOutputs) {
      const inputNodePosition = {
        x: node.position.x - 350,
        y: node.position.y
      };
      
      // Vérifier que les positions ne se superposent pas
      if (flowStateService.isPositionFree(inputNodePosition)) {
        // Créer le nœud temporaire via le service centralisé
        const inputTempNode = flowStateService.createTemporaryNode({
          id: generateGuid(),
          type: itemType,
          text: `${itemType} (Connexion à l'entrée)`,
          position: inputNodePosition,
          maxInputs: flowStateService.getDefaultMaxInputs(itemType),
          maxOutputs: flowStateService.getDefaultMaxOutputs(itemType)
        });
        
        // Créer une connexion temporaire via le service centralisé
        flowStateService.createTemporaryConnection({
          id: generateGuid(),
          sourceId: `output_${inputTempNode.id}`,
          targetId: `input_${node.id}`
        });
        
        createdNodesCount++;
      }
    }
    
    return createdNodesCount;
  }
  
  /**
   * Trouve un nœud connecté par son ID
   * @param nodeId ID du nœud à trouver
   * @returns Le nœud trouvé ou undefined
   * @private
   */
  private findConnectedNode(nodeId: string): CrmNode | undefined {
    return this.getAllNodes().find(n => n.id === nodeId);
  }

}

/**
 * Factory pour créer les stratégies de nœuds temporaires
 */
export class TemporaryNodeStrategyFactory {
  private strategies: CentralizedTemporaryNodeStrategy[];
  
  constructor(private getAllNodes: () => CrmNode[]) {
    this.strategies = [
      new BinarySplitStrategy(getAllNodes),
      new MultiSplitStrategy(getAllNodes),
      new StandardNodeStrategy() // Stratégie par défaut en dernier
    ];
  }
  
  /**
   * Renvoie la stratégie appropriée pour un nœud spécifique
   * @param node Le nœud existant
   * @param existingOutputConnections Les connexions de sortie existantes
   * @param existingInputConnections Les connexions d'entrée existantes
   * @param itemType Le type d'élément en cours de drag
   * @returns La stratégie à utiliser
   */
  getStrategy(
    node: CrmNode,
    existingOutputConnections: Connection[],
    existingInputConnections: Connection[],
    itemType: string
  ): CentralizedTemporaryNodeStrategy {
    // Trouver la première stratégie qui peut être appliquée
    const strategy = this.strategies.find(s => 
      s.canApply(node, existingOutputConnections, existingInputConnections, itemType)
    );
    
    // Si aucune stratégie n'est trouvée, utiliser la dernière (la stratégie standard)
    return strategy || this.strategies[this.strategies.length - 1];
  }
} 