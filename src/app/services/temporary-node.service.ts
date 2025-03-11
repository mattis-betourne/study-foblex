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
   * Fonction de vérification si une position est libre
   * @private
   */
  private _isPositionFreeFn: (position: {x: number, y: number}) => boolean = 
    () => true;

  /**
   * Fonction pour obtenir le nombre maximum d'entrées par défaut
   * @private
   */
  private _getDefaultMaxInputsFn: (type: string) => number = 
    () => 1;

  /**
   * Fonction pour obtenir le nombre maximum de sorties par défaut
   * @private
   */
  private _getDefaultMaxOutputsFn: (type: string) => number = 
    () => 1;

  /**
   * Fonction pour obtenir les nœuds existants
   * @private
   */
  private _getNodesFn: () => CrmNode[] = 
    () => [];

  /**
   * Fonction pour obtenir les connexions
   * @private
   */
  private _getConnectionsFn: () => Connection[] = 
    () => [];

  /**
   * Factory pour les stratégies de création de nœuds temporaires
   * @private
   */
  private strategyFactory: TemporaryNodeStrategyFactory;

  constructor() {
    // Initialiser la factory avec une fonction qui sera mise à jour plus tard
    this.strategyFactory = new TemporaryNodeStrategyFactory(this._getNodesFn);
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
   * Configure les fonctions de support pour la création de nœuds temporaires
   * @param isPositionFree Fonction pour vérifier si une position est libre
   * @param getDefaultMaxInputs Fonction pour obtenir le max d'entrées par défaut
   * @param getDefaultMaxOutputs Fonction pour obtenir le max de sorties par défaut
   * @param getNodes Fonction pour obtenir les nœuds existants
   * @param getConnections Fonction pour obtenir les connexions existantes
   */
  setSupport(
    isPositionFree: (position: {x: number, y: number}) => boolean,
    getDefaultMaxInputs: (type: string) => number,
    getDefaultMaxOutputs: (type: string) => number,
    getNodes: () => CrmNode[],
    getConnections?: () => Connection[]
  ): void {
    this._isPositionFreeFn = isPositionFree;
    this._getDefaultMaxInputsFn = getDefaultMaxInputs;
    this._getDefaultMaxOutputsFn = getDefaultMaxOutputs;
    this._getNodesFn = getNodes;
    
    if (getConnections) {
      this._getConnectionsFn = getConnections;
    }
    
    // Mettre à jour la factory avec la nouvelle fonction
    this.strategyFactory = new TemporaryNodeStrategyFactory(this._getNodesFn);
  }

  /**
   * Nettoie les éléments temporaires
   */
  clearTemporaryElements(): void {
    // Effacer les nœuds et connexions temporaires
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
    const nodes = this._getNodesFn();
    if (nodes.length === 0) {
      console.log('No existing nodes to create temporary connections to, creating central node');
      
      // Créer un nœud temporaire central si aucun nœud n'existe
      this.createCentralTemporaryNode(itemType);
      return;
    }
    
    // Obtenir les restrictions pour le type de nœud en cours de drag
    const maxInputsForType = this._getDefaultMaxInputsFn(itemType);
    const maxOutputsForType = this._getDefaultMaxOutputsFn(itemType);
    
    console.log(`Creating temp nodes for type ${itemType} with max inputs: ${maxInputsForType}, max outputs: ${maxOutputsForType}`);
    
    const allTempNodes: CrmNode[] = [];
    const allTempConnections: Connection[] = [];
    
    // Obtenir toutes les connexions
    const allConnections = this._getConnectionsFn();
    
    // Pour chaque nœud existant
    nodes.forEach(node => {
      // Obtenir les connexions existantes pour ce nœud
      const existingOutputConnections = this.getConnectionsFrom(`output_${node.id}`);
      const existingInputConnections = this.getConnectionsTo(`input_${node.id}`);
      
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
        
        // Créer les nœuds temporaires avec cette stratégie
        const result = strategy.createTemporaryNodes(
          node,
          existingOutputConnections,
          existingInputConnections,
          itemType,
          this._isPositionFreeFn,
          this._getDefaultMaxInputsFn,
          this._getDefaultMaxOutputsFn
        );
        
        console.log(`Strategy created ${result.nodes.length} temporary nodes and ${result.connections.length} connections`);
        
        // Ajouter les nœuds et connexions temporaires aux collections
        allTempNodes.push(...result.nodes);
        allTempConnections.push(...result.connections);
      } else {
        console.log(`Skipping temporary node creation for node ${node.id} (${node.type}) - restrictions apply`);
      }
    });
    
    console.log(`Created ${allTempNodes.length} temporary nodes and ${allTempConnections.length} connections`);
    
    // Mettre à jour les signaux avec les nouveaux nœuds et connexions temporaires
    this.flowStateService.updateTemporaryNodes(allTempNodes);
    this.flowStateService.updateTemporaryConnections(allTempConnections);
  }

  /**
   * Crée un nœud temporaire central si aucun nœud n'existe
   * @param itemType Type d'élément à créer
   * @private
   */
  private createCentralTemporaryNode(itemType: string): void {
    // Créer un nœud temporaire au centre du canvas
    const centralTempNode: CrmNode = {
      id: `temp_central_${Math.floor(Math.random() * 10000)}`,
      type: itemType,
      text: `${itemType} (Drop here)`,
      position: { x: 400, y: 300 },
      maxInputs: this._getDefaultMaxInputsFn(itemType),
      maxOutputs: this._getDefaultMaxOutputsFn(itemType)
    };
    
    console.log('Created central temporary node:', centralTempNode);
    
    // Mettre à jour les signaux
    this.flowStateService.updateTemporaryNodes([centralTempNode]);
    this.flowStateService.updateTemporaryConnections([]);
  }

  /**
   * Obtient les connexions sortantes d'un nœud
   * @param nodeId Identifiant du nœud
   * @returns Connexions sortantes
   * @private
   */
  private getConnectionsFrom(nodeId: string): Connection[] {
    return this._getConnectionsFn().filter(conn => conn.sourceId === nodeId);
  }

  /**
   * Obtient les connexions entrantes d'un nœud
   * @param nodeId Identifiant du nœud
   * @returns Connexions entrantes
   * @private
   */
  private getConnectionsTo(nodeId: string): Connection[] {
    return this._getConnectionsFn().filter(conn => conn.targetId === nodeId);
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
    // Trouver le nœud temporaire
    const temporaryNode = this.temporaryNodes.find(node => node.id === temporaryNodeId);
    if (!temporaryNode) {
      console.warn(`Temporary node with id ${temporaryNodeId} not found`);
      return null;
    }

    // Trouver les connexions liées à ce nœud temporaire
    const relatedConnections = this.temporaryConnections.filter(
      conn => conn.sourceId.includes(temporaryNodeId) || conn.targetId.includes(temporaryNodeId)
    );

    console.log('Found related temporary connections:', relatedConnections);

    // Préparer les informations pour la création du nœud réel
    const result = {
      nodeType: temporaryNode.type,
      position: { ...temporaryNode.position },
      connections: relatedConnections.map(conn => {
        const isSource = conn.sourceId.includes(temporaryNodeId);
        
        // Conserver le format des identifiants (input_/output_)
        return {
          sourceId: isSource ? '' : conn.sourceId,
          targetId: !isSource ? '' : conn.targetId
        };
      })
    };

    console.log('Prepared result for node creation:', result);

    // Nettoyer les nœuds temporaires
    this.clearTemporaryElements();

    return result;
  }
} 