import { CrmNode, Connection, TemporaryNodesResult, TemporaryNodeStrategy } from '../models/crm.models';
import { generateGuid } from '../utils/guid';

/**
 * Stratégie standard pour la création de nœuds temporaires
 */
export class StandardNodeStrategy implements TemporaryNodeStrategy {
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
    isPositionFree: (position: {x: number, y: number}) => boolean,
    getDefaultMaxInputs: (type: string) => number,
    getDefaultMaxOutputs: (type: string) => number
  ): TemporaryNodesResult {
    const result: TemporaryNodesResult = {
      nodes: [],
      connections: []
    };
    
    const canAcceptMoreOutputs = node.maxOutputs === undefined || 
      existingOutputConnections.length < node.maxOutputs;
      
    const canAcceptMoreInputs = node.maxInputs === undefined || 
      existingInputConnections.length < node.maxInputs;
    
    // Vérifier si le nœud du type dragué peut avoir des entrées
    const newNodeCanHaveInputs = getDefaultMaxInputs(itemType) > 0;
    
    // Créer un nœud temporaire à droite du nœud existant
    if (canAcceptMoreOutputs && newNodeCanHaveInputs) {
      const rightTempNode: CrmNode = {
        id: `temp_right_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Drop here to connect)`,
        position: { 
          x: node.position.x + 250, 
          y: node.position.y 
        },
        maxInputs: getDefaultMaxInputs(itemType),
        maxOutputs: getDefaultMaxOutputs(itemType)
      };
      
      // Vérifier que les positions ne se superposent pas
      if (isPositionFree(rightTempNode.position)) {
        result.nodes.push(rightTempNode);
        
        // Créer une connexion temporaire
        const rightConnection: Connection = {
          id: `temp_conn_${generateGuid()}`,
          sourceId: `output_${node.id}`,
          targetId: `input_${rightTempNode.id}`
        };
        result.connections.push(rightConnection);
      }
    }
    
    // Vérifier si le nœud du type dragué peut avoir des sorties
    const newNodeCanHaveOutputs = getDefaultMaxOutputs(itemType) > 0;
    
    // Créer un nœud temporaire en dessous du nœud existant
    if (canAcceptMoreInputs && newNodeCanHaveOutputs) {
      const bottomTempNode: CrmNode = {
        id: `temp_bottom_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Drop here to connect)`,
        position: { 
          x: node.position.x, 
          y: node.position.y + 200
        },
        maxInputs: getDefaultMaxInputs(itemType),
        maxOutputs: getDefaultMaxOutputs(itemType)
      };
      
      // Vérifier que les positions ne se superposent pas
      if (isPositionFree(bottomTempNode.position)) {
        result.nodes.push(bottomTempNode);
        
        // Créer une connexion temporaire
        const bottomConnection: Connection = {
          id: `temp_conn_${generateGuid()}`,
          sourceId: `output_${bottomTempNode.id}`,
          targetId: `input_${node.id}`
        };
        result.connections.push(bottomConnection);
      }
    }
    
    return result;
  }
}

/**
 * Stratégie pour la création de nœuds temporaires autour d'un BinarySplit
 */
export class BinarySplitStrategy implements TemporaryNodeStrategy {
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
    isPositionFree: (position: {x: number, y: number}) => boolean,
    getDefaultMaxInputs: (type: string) => number,
    getDefaultMaxOutputs: (type: string) => number
  ): TemporaryNodesResult {
    const result: TemporaryNodesResult = {
      nodes: [],
      connections: []
    };
    
    // Pour un BinarySplit, autoriser l'ajout de connections si moins de 2 sorties
    const canAcceptMoreOutputs = existingOutputConnections.length < 2;
    const canAcceptMoreInputs = existingInputConnections.length < 1;
    
    // Vérifier si le nœud du type dragué peut avoir des entrées
    const newNodeCanHaveInputs = getDefaultMaxInputs(itemType) > 0;
    
    if (canAcceptMoreOutputs && newNodeCanHaveInputs) {
      // Calculer des positions pour les deux sorties du BinarySplit
      const positions = [
        { // Position en haut à droite
          x: node.position.x + 250,
          y: node.position.y - 80
        },
        { // Position en bas à droite
          x: node.position.x + 250,
          y: node.position.y + 80
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
        if (!usedPositionIndices.has(i) && isPositionFree(positions[i])) {
          const binarySplitTempNode: CrmNode = {
            id: `temp_binarysplit_${i}_${generateGuid()}`,
            type: itemType,
            text: `${itemType} (Branche ${i === 0 ? 'supérieure' : 'inférieure'})`,
            position: positions[i],
            maxInputs: getDefaultMaxInputs(itemType),
            maxOutputs: getDefaultMaxOutputs(itemType)
          };
          
          result.nodes.push(binarySplitTempNode);
          
          // Créer une connexion temporaire
          const binarySplitConnection: Connection = {
            id: `temp_conn_${generateGuid()}`,
            sourceId: `output_${node.id}`,
            targetId: `input_${binarySplitTempNode.id}`
          };
          result.connections.push(binarySplitConnection);
        }
      }
    }
    
    // Le reste de la logique standard pour l'entrée du BinarySplit
    const newNodeCanHaveOutputs = getDefaultMaxOutputs(itemType) > 0;
    
    if (canAcceptMoreInputs && newNodeCanHaveOutputs) {
      const bottomTempNode: CrmNode = {
        id: `temp_bottom_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Connexion à l'entrée)`,
        position: { 
          x: node.position.x - 250, 
          y: node.position.y
        },
        maxInputs: getDefaultMaxInputs(itemType),
        maxOutputs: getDefaultMaxOutputs(itemType)
      };
      
      // Vérifier que les positions ne se superposent pas
      if (isPositionFree(bottomTempNode.position)) {
        result.nodes.push(bottomTempNode);
        
        // Créer une connexion temporaire
        const bottomConnection: Connection = {
          id: `temp_conn_${generateGuid()}`,
          sourceId: `output_${bottomTempNode.id}`,
          targetId: `input_${node.id}`
        };
        result.connections.push(bottomConnection);
      }
    }
    
    return result;
  }
  
  // Méthode pour trouver un nœud connecté en utilisant la fonction passée au constructeur
  private findConnectedNode(nodeId: string): CrmNode | undefined {
    return this.getAllNodes().find(node => node.id === nodeId);
  }
}

/**
 * Stratégie pour la création de nœuds temporaires autour d'un MultiSplit
 */
export class MultiSplitStrategy implements TemporaryNodeStrategy {
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
    isPositionFree: (position: {x: number, y: number}) => boolean,
    getDefaultMaxInputs: (type: string) => number,
    getDefaultMaxOutputs: (type: string) => number
  ): TemporaryNodesResult {
    const result: TemporaryNodesResult = {
      nodes: [],
      connections: []
    };
    
    // Pour un MultiSplit, autoriser l'ajout de connexions si moins de 5 sorties
    const maxOutputs = 5;
    const canAcceptMoreOutputs = existingOutputConnections.length < maxOutputs;
    const canAcceptMoreInputs = existingInputConnections.length < 1;
    
    // Vérifier si le nœud du type dragué peut avoir des entrées
    const newNodeCanHaveInputs = getDefaultMaxInputs(itemType) > 0;
    
    if (canAcceptMoreOutputs && newNodeCanHaveInputs) {
      // Calculer des positions pour les branches du MultiSplit
      // Disposition en éventail : un nœud au milieu et les autres autour
      const angleStep = Math.PI / (maxOutputs + 1);
      const radius = 200; // Distance par rapport au nœud MultiSplit
      
      // Déterminer quelles positions sont déjà occupées
      const usedAngles = new Set<number>();
      
      // Trouver les nœuds cibles des connexions existantes
      for (const conn of existingOutputConnections) {
        const targetNodeId = conn.targetId.replace('input_', '');
        const targetNode = this.findConnectedNode(targetNodeId);
        
        if (targetNode) {
          // Calculer l'angle approximatif par rapport au MultiSplit
          const dx = targetNode.position.x - node.position.x;
          const dy = targetNode.position.y - node.position.y;
          const angle = Math.atan2(dy, dx);
          
          // Trouver l'index de l'angle le plus proche
          const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
          const angleIndex = Math.round(normalizedAngle / angleStep) - 1;
          
          if (angleIndex >= 0 && angleIndex < maxOutputs) {
            usedAngles.add(angleIndex);
          }
        }
      }
      
      // Créer des nœuds temporaires pour les positions disponibles
      for (let i = 0; i < maxOutputs; i++) {
        if (!usedAngles.has(i)) {
          // Calculer l'angle et la position
          const angle = (i + 1) * angleStep;
          const x = node.position.x + radius * Math.cos(angle);
          const y = node.position.y + radius * Math.sin(angle);
          
          // Vérifier que la position est libre
          if (isPositionFree({ x, y })) {
            const multiSplitTempNode: CrmNode = {
              id: `temp_multisplit_${i}_${generateGuid()}`,
              type: itemType,
              text: `${itemType} (Branche ${i + 1})`,
              position: { x, y },
              maxInputs: getDefaultMaxInputs(itemType),
              maxOutputs: getDefaultMaxOutputs(itemType)
            };
            
            result.nodes.push(multiSplitTempNode);
            
            // Créer une connexion temporaire
            const multiSplitConnection: Connection = {
              id: `temp_conn_${generateGuid()}`,
              sourceId: `output_${node.id}`,
              targetId: `input_${multiSplitTempNode.id}`
            };
            result.connections.push(multiSplitConnection);
          }
        }
      }
    }
    
    // Gérer l'entrée du MultiSplit si nécessaire
    const newNodeCanHaveOutputs = getDefaultMaxOutputs(itemType) > 0;
    
    if (canAcceptMoreInputs && newNodeCanHaveOutputs) {
      const inputTempNode: CrmNode = {
        id: `temp_input_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Connexion à l'entrée)`,
        position: { 
          x: node.position.x - 250, 
          y: node.position.y
        },
        maxInputs: getDefaultMaxInputs(itemType),
        maxOutputs: getDefaultMaxOutputs(itemType)
      };
      
      // Vérifier que la position est libre
      if (isPositionFree(inputTempNode.position)) {
        result.nodes.push(inputTempNode);
        
        // Créer une connexion temporaire
        const inputConnection: Connection = {
          id: `temp_conn_${generateGuid()}`,
          sourceId: `output_${inputTempNode.id}`,
          targetId: `input_${node.id}`
        };
        result.connections.push(inputConnection);
      }
    }
    
    return result;
  }
  
  // Méthode pour trouver un nœud connecté en utilisant la fonction passée au constructeur
  private findConnectedNode(nodeId: string): CrmNode | undefined {
    return this.getAllNodes().find(node => node.id === nodeId);
  }
}

/**
 * Factory qui retourne la stratégie appropriée selon le type de nœud
 */
export class TemporaryNodeStrategyFactory {
  constructor(private getAllNodes: () => CrmNode[]) {
    this.strategies = [
      new BinarySplitStrategy(getAllNodes),
      new MultiSplitStrategy(getAllNodes),
      new StandardNodeStrategy() // Stratégie par défaut, doit être en dernier
    ];
  }

  private strategies: TemporaryNodeStrategy[];
  
  getStrategy(
    node: CrmNode,
    existingOutputConnections: Connection[],
    existingInputConnections: Connection[],
    itemType: string
  ): TemporaryNodeStrategy {
    for (const strategy of this.strategies) {
      if (strategy.canApply(node, existingOutputConnections, existingInputConnections, itemType)) {
        return strategy;
      }
    }
    // La stratégie par défaut devrait toujours être applicable
    return this.strategies[this.strategies.length - 1];
  }
} 