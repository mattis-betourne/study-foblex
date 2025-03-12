import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CrmNode, Connection } from '../models/crm.models';
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
   * Observable des nœuds temporaires
   */
  readonly temporaryNodes$ = toObservable(this.flowStateService.temporaryNodes);
  
  /**
   * Observable des connexions temporaires
   */
  readonly temporaryConnections$ = toObservable(this.flowStateService.temporaryConnections);
  
  /**
   * Observable du type d'élément en cours de glisser-déposer
   */
  readonly draggingItemType$ = toObservable(this.flowStateService.draggingItemType);
  
  /**
   * Observable indiquant si un nœud est en cours de création
   */
  readonly isCreatingNode$ = toObservable(this.flowStateService.isCreatingNode);

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
    
    // D'abord, nettoyer les anciens nœuds temporaires
    this.clearTemporaryElements();
    
    // Pour chaque nœud existant, créer un nœud temporaire qui pourrait s'y connecter
    const nodes = this.flowStateService.nodes();
    if (nodes.length === 0) {
      console.log('No existing nodes to create temporary connections to, creating central node');
      
      // Créer un nœud temporaire central si aucun nœud n'existe
      this.createCentralTemporaryNode(itemType);
      return;
    }
    
    // Obtenir les restrictions pour le type de nœud en cours de drag
    const maxInputsForType = this.flowStateService.getDefaultMaxInputs(itemType);
    const maxOutputsForType = this.flowStateService.getDefaultMaxOutputs(itemType);
    
    console.log(`Creating temp nodes for type ${itemType} with max inputs: ${maxInputsForType}, max outputs: ${maxOutputsForType}`);
    
    // Compteur pour suivre le nombre total de nœuds créés
    let totalNodesCreated = 0;
    
    // Pour chaque nœud existant
    nodes.forEach(node => {
      // Obtenir les connexions existantes pour ce nœud
      const existingOutputConnections = this.flowStateService.getConnectionsFrom(`output_${node.id}`);
      const existingInputConnections = this.flowStateService.getConnectionsTo(`input_${node.id}`);
      
      console.log(`Node ${node.id} (${node.type}) has:
        - ${existingOutputConnections.length} output connections
        - ${existingInputConnections.length} input connections
        - Max outputs: ${node.maxOutputs !== undefined ? node.maxOutputs : 'unlimited'}
        - Max inputs: ${node.maxInputs !== undefined ? node.maxInputs : 'unlimited'}`);
      
      // Obtenir la stratégie appropriée pour ce nœud
      const strategy = this.strategyFactory.getStrategy(
        node, 
        existingOutputConnections, 
        existingInputConnections, 
        itemType
      );
      
      // Vérifier si le nœud a atteint son maximum de connexions
      const canAcceptMoreOutputs = node.maxOutputs === undefined || 
        existingOutputConnections.length < node.maxOutputs;
      
      const canAcceptMoreInputs = node.maxInputs === undefined || 
        existingInputConnections.length < node.maxInputs;
      
      console.log(`For dragged type ${itemType} with node ${node.id}:
        - Can accept more outputs: ${canAcceptMoreOutputs}
        - Can accept more inputs: ${canAcceptMoreInputs}
        - Max inputs for dragged type: ${maxInputsForType}
        - Max outputs for dragged type: ${maxOutputsForType}`);
      
      // Seulement créer des nœuds temporaires si le nœud peut accepter plus de connexions
      // et si le type dragué peut avoir des entrées/sorties
      if ((canAcceptMoreOutputs && maxInputsForType > 0) || 
          (canAcceptMoreInputs && maxOutputsForType > 0)) {
        console.log(`Creating temporary nodes around node ${node.id} (${node.type})`);
        
        // Créer les nœuds temporaires avec cette stratégie en passant directement le service d'état
        const nodesCreated = strategy.createTemporaryNodes(
          node,
          existingOutputConnections,
          existingInputConnections,
          itemType,
          this.flowStateService
        );
        
        totalNodesCreated += nodesCreated;
        console.log(`Strategy created ${nodesCreated} temporary nodes for node ${node.id}`);
      } else {
        console.log(`Skipping temporary node creation for node ${node.id} (${node.type}) - restrictions apply`);
      }
    });
    
    console.log(`Finished creating ${totalNodesCreated} temporary nodes and connections`);
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
} 