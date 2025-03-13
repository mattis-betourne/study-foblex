import { Injectable, inject } from '@angular/core';
import { Connection, CrmNode } from '../models/crm.models';
import { TemporaryNodeStrategyFactory } from '../strategies/temporary-node-strategies';
import { FlowStateService } from './flow-state.service';

/**
 * Service dédié à la gestion des nœuds temporaires
 * Respecte le principe de responsabilité unique (SRP)
 */
@Injectable({
  providedIn: 'root'
})
export class TemporaryNodeService {
  /**
   * Service d'état du flow
   * @private
   */
  private readonly flowStateService = inject(FlowStateService);

  /**
   * Factory pour les stratégies de création de nœuds temporaires
   * @private
   */
  private strategyFactory: TemporaryNodeStrategyFactory;

  constructor() {
    // Initialiser la factory en lui passant directement la méthode du FlowStateService
    this.strategyFactory = new TemporaryNodeStrategyFactory(() => this.flowStateService.nodes());
  }

  /**
   * @returns Les nœuds temporaires actuels
   */
  get temporaryNodes(): CrmNode[] {
    return this.flowStateService.temporaryNodes();
  }

  /**
   * @returns Les connexions temporaires actuelles
   */
  get temporaryConnections(): Connection[] {
    return this.flowStateService.temporaryConnections();
  }

  /**
   * @returns Le type d'élément en cours de glisser-déposer
   */
  get draggingItemType(): string | null {
    return this.flowStateService.draggingItemType();
  }

  /**
   * @param value Le type d'élément en cours de glisser-déposer
   */
  set draggingItemType(value: string | null) {
    this.flowStateService.updateDraggingItemType(value);
  }

  /**
   * @returns Si un nœud est en cours de création
   */
  get isCreatingNode(): boolean {
    return this.flowStateService.isCreatingNode();
  }

  /**
   * @param value Si un nœud est en cours de création
   */
  set isCreatingNode(value: boolean) {
    this.flowStateService.updateIsCreatingNode(value);
  }

  /**
   * Nettoie les éléments temporaires
   */
  clearTemporaryElements(): void {
    // Déléguer au FlowStateService
    this.flowStateService.clearTemporaryElements();
  }

  /**
   * Crée des nœuds temporaires pour les emplacements potentiels de connexion
   * @param itemType Le type d'élément en cours de glisser-déposer
   */
  createTemporaryNodes(itemType: string): void {
    console.log('Creating temporary nodes for item type:', itemType);
    
    this.clearTemporaryElements();
    
    const nodes = this.flowStateService.nodes();
    if (nodes.length === 0) {
      this.createCentralTemporaryNode(itemType);
      return;
    }
    
    // Obtenir toutes les connexions existantes une seule fois
    const allConnections = this.flowStateService.connections();
    // Garder une trace des connexions déjà traitées
    const processedConnectionIds = new Set<string>();
    
    // Pour chaque nœud existant
    nodes.forEach(node => {
      // Obtenir les connexions existantes pour ce nœud
      const existingOutputConnections = allConnections.filter(
        conn => conn.sourceId === `output_${node.id}`
      );
      const existingInputConnections = allConnections.filter(
        conn => conn.targetId === `input_${node.id}`
      );
      
      // Obtenir la stratégie appropriée pour ce nœud
      const strategy = this.strategyFactory.getStrategy(
        node, 
        existingOutputConnections, 
        existingInputConnections, 
        itemType
      );
      
      // Créer les nœuds temporaires avec cette stratégie
      strategy.createTemporaryNodes(
        node,
        existingOutputConnections,
        existingInputConnections,
        itemType,
        this.flowStateService
      );
      
      // Marquer toutes les connexions de ce nœud comme traitées
      existingOutputConnections.forEach(conn => processedConnectionIds.add(conn.id));
      existingInputConnections.forEach(conn => processedConnectionIds.add(conn.id));
    });

    // Traiter uniquement les connexions qui n'ont pas encore été traitées
    const maxInputsForType = this.flowStateService.getDefaultMaxInputs(itemType);
    const maxOutputsForType = this.flowStateService.getDefaultMaxOutputs(itemType);
    const newNodeCanHaveInputs = maxInputsForType > 0;
    const newNodeCanHaveOutputs = maxOutputsForType > 0;

    if (newNodeCanHaveInputs && newNodeCanHaveOutputs) {
      const unprocessedConnections = allConnections.filter(conn => !processedConnectionIds.has(conn.id));
      const connectionGroups = this.groupConnectionsBySpace(unprocessedConnections, nodes);
      
      connectionGroups.forEach(group => {
        const { connection, sourceNode, targetNode } = group;
        
        // Calculer l'angle de la connexion
        const angle = Math.atan2(
          targetNode.position.y - sourceNode.position.y,
          targetNode.position.x - sourceNode.position.x
        );

        // Calculer la distance entre les nœuds
        const distance = Math.sqrt(
          Math.pow(targetNode.position.x - sourceNode.position.x, 2) +
          Math.pow(targetNode.position.y - sourceNode.position.y, 2)
        );

        // Si la distance est suffisante pour insérer un nœud (> 300px)
        if (distance > 300) {
          // Position de base au milieu
          const basePosition = {
            x: sourceNode.position.x + (targetNode.position.x - sourceNode.position.x) / 2,
            y: sourceNode.position.y + (targetNode.position.y - sourceNode.position.y) / 2
          };

          // Ajouter un décalage perpendiculaire à la ligne de connexion
          const offset = 40; // Décalage de base
          const perpAngle = angle + Math.PI / 2; // Angle perpendiculaire
          
          // Calculer plusieurs positions potentielles avec des décalages différents
          const potentialPositions = [
            basePosition,
            {
              x: basePosition.x + Math.cos(perpAngle) * offset,
              y: basePosition.y + Math.sin(perpAngle) * offset
            },
            {
              x: basePosition.x - Math.cos(perpAngle) * offset,
              y: basePosition.y - Math.sin(perpAngle) * offset
            }
          ];

          // Trouver la première position libre
          const position = potentialPositions.find(pos => 
            this.isPositionTrulyFree(pos, nodes, this.flowStateService.temporaryNodes())
          );

          if (position) {
            const tempNode = this.flowStateService.createTemporaryNode({
              id: `temp_${Date.now()}_${Math.random()}`,
              type: itemType,
              text: `${itemType} (Insérer ici)`,
              position,
              maxInputs: maxInputsForType,
              maxOutputs: maxOutputsForType
            });

            // Créer les connexions temporaires
            this.flowStateService.createTemporaryConnection({
              id: `temp_conn_${Date.now()}_1`,
              sourceId: connection.sourceId,
              targetId: `input_${tempNode.id}`
            });

            this.flowStateService.createTemporaryConnection({
              id: `temp_conn_${Date.now()}_2`,
              sourceId: `output_${tempNode.id}`,
              targetId: connection.targetId
            });
          }
        }
      });
    }
  }

  /**
   * Crée un nœud temporaire central si aucun nœud n'existe
   * @param itemType Type d'élément à créer
   * @private
   */
  private createCentralTemporaryNode(itemType: string): void {
    // Créer un nœud temporaire au centre du canvas en utilisant la méthode centralisée
    this.flowStateService.createTemporaryNode({
      type: itemType,
      text: `${itemType} (Drop here)`,
      position: { x: 400, y: 300 }
      // Les maxInputs et maxOutputs seront automatiquement définis par createTemporaryNode
    });
    
    console.log('Created central temporary node for empty flow');
  }

  /**
   * Traite la fin d'un glisser-déposer sur un nœud temporaire
   * @param temporaryNodeId Identifiant du nœud temporaire
   * @returns Information sur le nœud temporaire et ses connexions
   */
  handleDropOnTemporaryNode(temporaryNodeId: string): {
    nodeType: string;
    position: {x: number, y: number};
    connections: {sourceId: string, targetId: string}[];
  } | null {
    // Déléguer la conversion au FlowStateService et récupérer le résultat
    const permanentNode = this.flowStateService.convertTemporaryNodeToPermanent(temporaryNodeId);
    
    if (!permanentNode) {
      console.warn(`Failed to convert temporary node ${temporaryNodeId} to permanent node`);
      return null;
    }
    
    // Pour maintenir la compatibilité avec le code existant, retourner le format attendu
    return {
      nodeType: permanentNode.type,
      position: { ...permanentNode.position },
      connections: [] // Les connexions ont déjà été créées par convertTemporaryNodeToPermanent
    };
  }

  /**
   * Groupe les connexions par espace disponible
   */
  private groupConnectionsBySpace(connections: Connection[], nodes: CrmNode[]): Array<{
    connection: Connection;
    sourceNode: CrmNode;
    targetNode: CrmNode;
  }> {
    return connections
      .map(connection => {
        const sourceId = connection.sourceId.replace('output_', '');
        const targetId = connection.targetId.replace('input_', '');
        const sourceNode = nodes.find(n => n.id === sourceId);
        const targetNode = nodes.find(n => n.id === targetId);
        
        if (sourceNode && targetNode) {
          return { connection, sourceNode, targetNode };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  /**
   * Vérifie si une position est vraiment libre en tenant compte des marges et des autres nœuds
   */
  private isPositionTrulyFree(
    position: { x: number; y: number },
    permanentNodes: CrmNode[],
    temporaryNodes: CrmNode[]
  ): boolean {
    const margin = 150; // Marge de sécurité
    const allNodes = [...permanentNodes, ...temporaryNodes];
    
    // Vérifier la distance avec tous les nœuds existants
    return !allNodes.some(node => {
      const distance = Math.sqrt(
        Math.pow(node.position.x - position.x, 2) +
        Math.pow(node.position.y - position.y, 2)
      );
      return distance < margin;
    });
  }
}