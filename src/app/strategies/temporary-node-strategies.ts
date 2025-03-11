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
    
    // Vérifier si le nœud existant peut accepter plus de connexions
    const canAcceptMoreOutputs = node.maxOutputs === undefined || 
      existingOutputConnections.length < node.maxOutputs;
      
    const canAcceptMoreInputs = node.maxInputs === undefined || 
      existingInputConnections.length < node.maxInputs;
    
    // Obtenir les limites du type de nœud en cours de drag
    const maxInputsForType = getDefaultMaxInputs(itemType);
    const maxOutputsForType = getDefaultMaxOutputs(itemType);
    
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
      const existingTypeMaxOutputs = getDefaultMaxOutputs(node.type);
      if (existingTypeMaxOutputs > 0) {
        const rightTempNode: CrmNode = {
          id: `temp_right_${generateGuid()}`,
          type: itemType,
          text: `${itemType} (Drop here to connect)`,
          position: { 
            x: node.position.x + 250, 
            y: node.position.y 
          },
          maxInputs: maxInputsForType,
          maxOutputs: maxOutputsForType
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
    }
    
    // Vérifier si le nœud du type dragué peut avoir des sorties
    const newNodeCanHaveOutputs = maxOutputsForType > 0;
    
    // Créer un nœud temporaire en dessous du nœud existant (nouveau nœud -> nœud existant)
    if (canAcceptMoreInputs && newNodeCanHaveOutputs) {
      // Vérifier si le type de nœud existant et le type à créer sont compatibles
      const existingTypeMaxInputs = getDefaultMaxInputs(node.type);
      if (existingTypeMaxInputs > 0) {
        const bottomTempNode: CrmNode = {
          id: `temp_bottom_${generateGuid()}`,
          type: itemType,
          text: `${itemType} (Drop here to connect)`,
          position: { 
            x: node.position.x, 
            y: node.position.y + 200
          },
          maxInputs: maxInputsForType,
          maxOutputs: maxOutputsForType
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
      const inputTempNode: CrmNode = {
        id: `temp_bottom_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Connexion à l'entrée)`,
        position: { 
          x: node.position.x - 350,
          y: node.position.y
        },
        maxInputs: getDefaultMaxInputs(itemType),
        maxOutputs: getDefaultMaxOutputs(itemType)
      };
      
      // Vérifier que les positions ne se superposent pas
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
      // Disposition horizontale avec décalage vertical
      // Tous les nœuds à la même distance horizontale, mais à différentes hauteurs
      const horizontalOffset = 350; // Distance horizontale uniforme
      const verticalStep = 120;     // Espacement vertical entre chaque branche
      
      // Calculer la position verticale de départ pour centrer les branches
      const startY = node.position.y - ((maxOutputs - 1) * verticalStep) / 2;
      
      // Déterminer quelles positions sont déjà occupées
      const usedIndices = new Set<number>();
      
      // Trouver les nœuds cibles des connexions existantes
      for (const conn of existingOutputConnections) {
        const targetNodeId = conn.targetId.replace('input_', '');
        const targetNode = this.findConnectedNode(targetNodeId);
        
        if (targetNode) {
          // Déterminer quel indice de branche est le plus proche de ce nœud
          for (let i = 0; i < maxOutputs; i++) {
            const branchY = startY + i * verticalStep;
            // Si c'est à peu près la même position verticale, considérer comme utilisée
            if (Math.abs(targetNode.position.y - branchY) < verticalStep / 2) {
              usedIndices.add(i);
              break;
            }
          }
        }
      }
      
      // Créer des nœuds temporaires pour les positions disponibles
      for (let i = 0; i < maxOutputs; i++) {
        if (!usedIndices.has(i)) {
          const position = {
            x: node.position.x + horizontalOffset,
            y: startY + i * verticalStep
          };
          
          // Vérifier que la position est libre
          if (isPositionFree(position)) {
            const multiSplitTempNode: CrmNode = {
              id: `temp_multisplit_${i}_${generateGuid()}`,
              type: itemType,
              text: `${itemType} (Branche ${i + 1})`,
              position: position,
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
          x: node.position.x - 350,
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