import { generateGuid } from '@foblex/utils';
import { Connection, CrmNode } from '../models/crm.models';
import { FlowStateService } from '../services/flow-state.service';

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
    
    // 1. D'abord créer les nœuds temporaires classiques (autour des nœuds existants)
    const canAcceptMoreOutputs = node.maxOutputs === undefined || 
      existingOutputConnections.length < node.maxOutputs;
      
    const canAcceptMoreInputs = node.maxInputs === undefined || 
      existingInputConnections.length < node.maxInputs;
    
    const maxInputsForType = flowStateService.getDefaultMaxInputs(itemType);
    const maxOutputsForType = flowStateService.getDefaultMaxOutputs(itemType);
    
    const newNodeCanHaveInputs = maxInputsForType > 0;
    const newNodeCanHaveOutputs = maxOutputsForType > 0;

    // Création des nœuds temporaires autour du nœud existant (logique existante)
    if (canAcceptMoreOutputs && newNodeCanHaveInputs) {
      const existingTypeMaxOutputs = flowStateService.getDefaultMaxOutputs(node.type);
      if (existingTypeMaxOutputs > 0) {
        const rightNodePosition = { 
          x: node.position.x + 250, 
          y: node.position.y 
        };
        
        if (flowStateService.isPositionFree(rightNodePosition)) {
          const rightTempNode = flowStateService.createTemporaryNode({
            id: generateGuid(),
            type: itemType,
            text: `${itemType} (Drop here to connect)`,
            position: rightNodePosition,
            maxInputs: maxInputsForType,
            maxOutputs: maxOutputsForType
          });
          
          flowStateService.createTemporaryConnection({
            id: generateGuid(),
            sourceId: `output_${node.id}`,
            targetId: `input_${rightTempNode.id}`
          });
          
          createdNodesCount++;
        }
      }
    }
    
    if (canAcceptMoreInputs && newNodeCanHaveOutputs) {
      const existingTypeMaxInputs = flowStateService.getDefaultMaxInputs(node.type);
      if (existingTypeMaxInputs > 0) {
        const bottomNodePosition = { 
          x: node.position.x, 
          y: node.position.y + 200
        };

        if (flowStateService.isPositionFree(bottomNodePosition)) {
          const bottomTempNode = flowStateService.createTemporaryNode({
            id: generateGuid(),
            type: itemType,
            text: `${itemType} (Drop here to connect)`,
            position: bottomNodePosition,
            maxInputs: maxInputsForType,
            maxOutputs: maxOutputsForType
          });
          
          flowStateService.createTemporaryConnection({
            id: generateGuid(),
            sourceId: `output_${bottomTempNode.id}`,
            targetId: `input_${node.id}`
          });
          
          createdNodesCount++;
        }
      }
    }

    // 2. Ensuite, créer des nœuds temporaires sur les connexions sortantes existantes
    for (const connection of existingOutputConnections) {
      if (newNodeCanHaveInputs && newNodeCanHaveOutputs) {
        const targetNodeId = connection.targetId.replace('input_', '');
        const targetNode = flowStateService.nodes().find(n => n.id === targetNodeId);
        
        if (targetNode) {
          const middlePosition = {
            x: (node.position.x + targetNode.position.x) / 2,
            y: (node.position.y + targetNode.position.y) / 2
          };

          const offset = 25;
          middlePosition.y += offset;

          if (flowStateService.isPositionFree(middlePosition)) {
            const tempNode = flowStateService.createTemporaryNode({
              id: generateGuid(),
              type: itemType,
              text: `${itemType} (Insérer ici)`,
              position: middlePosition,
              maxInputs: maxInputsForType,
              maxOutputs: maxOutputsForType
            });

            flowStateService.createTemporaryConnection({
              id: generateGuid(),
              sourceId: `output_${node.id}`,
              targetId: `input_${tempNode.id}`
            });

            flowStateService.createTemporaryConnection({
              id: generateGuid(),
              sourceId: `output_${tempNode.id}`,
              targetId: connection.targetId
            });

            createdNodesCount++;
          }
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
    
    const canAcceptMoreOutputs = existingOutputConnections.length < 2;
    const canAcceptMoreInputs = existingInputConnections.length < 1;
    
    const newNodeCanHaveInputs = flowStateService.getDefaultMaxInputs(itemType) > 0;
    
    if (canAcceptMoreOutputs && newNodeCanHaveInputs) {
      const horizontalOffset = 350;
      const verticalOffset = 120;
      const positions = [
        {
          x: node.position.x + horizontalOffset,
          y: node.position.y - verticalOffset
        },
        {
          x: node.position.x + horizontalOffset,
          y: node.position.y + verticalOffset
        }
      ];
      
      const usedPositionIndices = new Set<number>();
      for (const conn of existingOutputConnections) {
        const targetNodeId = conn.targetId.replace('input_', '');
        const targetNode = this.findConnectedNode(targetNodeId);
        
        if (targetNode) {
          if (Math.abs(targetNode.position.y - positions[0].y) < 
              Math.abs(targetNode.position.y - positions[1].y)) {
            usedPositionIndices.add(0);
          } else {
            usedPositionIndices.add(1);
          }
        }
      }
      
      for (let i = 0; i < positions.length; i++) {
        if (!usedPositionIndices.has(i) && flowStateService.isPositionFree(positions[i])) {
          const binarySplitTempNode = flowStateService.createTemporaryNode({
            id: generateGuid(),
            type: itemType,
            text: `${itemType} (Branche ${i === 0 ? 'supérieure' : 'inférieure'})`,
            position: positions[i],
            maxInputs: flowStateService.getDefaultMaxInputs(itemType),
            maxOutputs: flowStateService.getDefaultMaxOutputs(itemType)
          });
          
          flowStateService.createTemporaryConnection({
            id: generateGuid(),
            sourceId: `output_${node.id}`,
            targetId: `input_${binarySplitTempNode.id}`
          });
          
          createdNodesCount++;
        }
      }
    }
    
    const newNodeCanHaveOutputs = flowStateService.getDefaultMaxOutputs(itemType) > 0;
    
    if (canAcceptMoreInputs && newNodeCanHaveOutputs) {
      const inputNodePosition = { 
        x: node.position.x - 350,
        y: node.position.y
      };
      
      if (flowStateService.isPositionFree(inputNodePosition)) {
        const inputTempNode = flowStateService.createTemporaryNode({
          id: generateGuid(),
          type: itemType,
          text: `${itemType} (Connexion à l'entrée)`,
          position: inputNodePosition,
          maxInputs: flowStateService.getDefaultMaxInputs(itemType),
          maxOutputs: flowStateService.getDefaultMaxOutputs(itemType)
        });
        
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
    
    const canAcceptMoreOutputs = existingOutputConnections.length < 5;
    const canAcceptMoreInputs = existingInputConnections.length < 1;
    
    const newNodeCanHaveInputs = flowStateService.getDefaultMaxInputs(itemType) > 0;
    
    if (canAcceptMoreOutputs && newNodeCanHaveInputs) {
      const horizontalOffset = 350;
      const verticalOffsetStep = 100;
      
      const positions = [
        {
          x: node.position.x + horizontalOffset,
          y: node.position.y
        },
        {
          x: node.position.x + horizontalOffset,
          y: node.position.y - verticalOffsetStep
        },
        {
          x: node.position.x + horizontalOffset,
          y: node.position.y + verticalOffsetStep
        },
        {
          x: node.position.x + horizontalOffset,
          y: node.position.y - (verticalOffsetStep * 2)
        },
        {
          x: node.position.x + horizontalOffset,
          y: node.position.y + (verticalOffsetStep * 2)
        }
      ];
      
      const usedPositionIndices = new Set<number>();
      for (const conn of existingOutputConnections) {
        const targetNodeId = conn.targetId.replace('input_', '');
        const targetNode = this.findConnectedNode(targetNodeId);
        
        if (targetNode) {
          let closestIndex = 0;
          let minDistance = Number.MAX_VALUE;
          
          positions.forEach((pos, index) => {
            const distance = Math.abs(targetNode.position.y - pos.y);
            if (distance < minDistance) {
              minDistance = distance;
              closestIndex = index;
            }
          });
          
          usedPositionIndices.add(closestIndex);
        }
      }
      
      for (let i = 0; i < positions.length; i++) {
        if (!usedPositionIndices.has(i) && flowStateService.isPositionFree(positions[i])) {
          let branchText;
          if (i === 0) branchText = "centrale";
          else if (i === 1) branchText = "supérieure";
          else if (i === 2) branchText = "inférieure";
          else if (i === 3) branchText = "haute";
          else branchText = "basse";
          
          const multiSplitTempNode = flowStateService.createTemporaryNode({
            id: generateGuid(),
            type: itemType,
            text: `${itemType} (Branche ${branchText})`,
            position: positions[i],
            maxInputs: flowStateService.getDefaultMaxInputs(itemType),
            maxOutputs: flowStateService.getDefaultMaxOutputs(itemType)
          });
          
          flowStateService.createTemporaryConnection({
            id: generateGuid(),
            sourceId: `output_${node.id}`,
            targetId: `input_${multiSplitTempNode.id}`
          });
          
          createdNodesCount++;
        }
      }
    }
    
    const newNodeCanHaveOutputs = flowStateService.getDefaultMaxOutputs(itemType) > 0;
    
    if (canAcceptMoreInputs && newNodeCanHaveOutputs) {
      const inputNodePosition = {
        x: node.position.x - 350,
        y: node.position.y
      };
      
      if (flowStateService.isPositionFree(inputNodePosition)) {
        const inputTempNode = flowStateService.createTemporaryNode({
          id: generateGuid(),
          type: itemType,
          text: `${itemType} (Connexion à l'entrée)`,
          position: inputNodePosition,
          maxInputs: flowStateService.getDefaultMaxInputs(itemType),
          maxOutputs: flowStateService.getDefaultMaxOutputs(itemType)
        });
        
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
    const strategy = this.strategies.find(s => 
      s.canApply(node, existingOutputConnections, existingInputConnections, itemType)
    );
    
    return strategy || this.strategies[this.strategies.length - 1];
  }
}