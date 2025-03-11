import { Injectable, ChangeDetectorRef, signal, effect, inject } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { generateGuid } from '@foblex/utils';
import { CrmNode, Connection } from '../models/crm.models';
import { BehaviorSubject, Observable } from 'rxjs';
import { HistoryService, FlowState } from './history.service';
import { TemporaryNodeStrategyFactory } from '../strategies/temporary-node-strategies';

/**
 * Service responsable de la gestion du flow diagram (nœuds, connexions, etc.)
 */
@Injectable({
  providedIn: 'root'
})
export class FlowService {
  // Signaux pour l'état principal
  private readonly _nodes = signal<CrmNode[]>([]);
  private readonly _connections = signal<Connection[]>([]);
  private readonly _temporaryNodes = signal<CrmNode[]>([]);
  private readonly _temporaryConnections = signal<Connection[]>([]);
  private readonly _draggingItemType = signal<string | null>(null);
  private readonly _isCreatingNode = signal<boolean>(false);

  /**
   * Référence au composant canvas pour les opérations de zoom
   */
  private _canvasRef: any = null;

  /**
   * Référence à la directive de zoom pour les opérations de zoom
   */
  private _zoomDirective: any = null;

  // Pour la compatibilité avec le code existant qui utilise l'API Observable
  readonly nodes$ = toObservable(this._nodes);
  readonly connections$ = toObservable(this._connections);
  readonly temporaryNodes$ = toObservable(this._temporaryNodes);
  readonly temporaryConnections$ = toObservable(this._temporaryConnections);
  readonly draggingItemType$ = toObservable(this._draggingItemType);
  readonly isCreatingNode$ = toObservable(this._isCreatingNode);

  private readonly historyService = inject(HistoryService);

  // Créer la factory des stratégies
  private readonly strategyFactory = new TemporaryNodeStrategyFactory(() => this._nodes());

  constructor() {
    // Capturer l'état initial après l'initialisation des données,
    // mais seulement si nous avons déjà des données
    setTimeout(() => {
      // Ne sauvegarder l'état initial que s'il y a effectivement des données
      if (this._nodes().length > 0 || this._connections().length > 0) {
        this.saveState();
      }
    }, 0);

    // Création d'un effet pour déboguer les changements d'état (utile en développement)
    // effect(() => {
    //   console.log('[FlowService] État mis à jour:', {
    //     nodes: this._nodes().length,
    //     connections: this._connections().length,
    //     tempNodes: this._temporaryNodes().length,
    //     tempConnections: this._temporaryConnections().length
    //   });
    // });
  }

  /**
   * @returns Les nœuds actuels du diagramme
   */
  get nodes(): CrmNode[] {
    return this._nodes();
  }

  /**
   * @returns Les connexions actuelles du diagramme
   */
  get connections(): Connection[] {
    return this._connections();
  }

  /**
   * @returns Les nœuds temporaires actuels
   */
  get temporaryNodes(): CrmNode[] {
    return this._temporaryNodes();
  }

  /**
   * @returns Les connexions temporaires actuelles
   */
  get temporaryConnections(): Connection[] {
    return this._temporaryConnections();
  }

  /**
   * @returns Le type d'élément en cours de drag
   */
  get draggingItemType(): string | null {
    return this._draggingItemType();
  }

  /**
   * @param value Le type d'élément en cours de drag
   */
  set draggingItemType(value: string | null) {
    this._draggingItemType.set(value);
  }

  /**
   * @returns Si un nœud est en cours de création
   */
  get isCreatingNode(): boolean {
    return this._isCreatingNode();
  }

  /**
   * @param value Si un nœud est en cours de création
   */
  set isCreatingNode(value: boolean) {
    this._isCreatingNode.set(value);
  }

  /**
   * Définit la référence au canvas
   * @param canvas Référence au canvas
   */
  setCanvasRef(canvas: any): void {
    this._canvasRef = canvas;
  }

  /**
   * Définit la référence à la directive de zoom
   * @param zoomDirective Référence à la directive de zoom
   */
  setZoomDirective(zoomDirective: any): void {
    this._zoomDirective = zoomDirective;
  }

  /**
   * Augmente le niveau de zoom
   * @param point Point central du zoom (optionnel)
   */
  zoomIn(point?: any): void {
    console.log('Zooming in...');
    if (this._zoomDirective) {
      this._zoomDirective.zoomIn(point);
    } else {
      console.warn('Zoom directive non disponible');
    }
  }

  /**
   * Diminue le niveau de zoom
   * @param point Point central du zoom (optionnel)
   */
  zoomOut(point?: any): void {
    console.log('Zooming out...');
    if (this._zoomDirective) {
      this._zoomDirective.zoomOut(point);
    } else {
      console.warn('Zoom directive non disponible');
    }
  }

  /**
   * Réinitialise le zoom et centre le canvas
   */
  resetZoom(): void {
    console.log('Resetting zoom...');
    if (this._zoomDirective) {
      this._zoomDirective.reset();
    } else {
      console.warn('Zoom directive non disponible');
    }
  }

  /**
   * Ajoute un nouveau nœud au diagramme
   * @param node Le nœud à ajouter
   */
  addNode(node: CrmNode): void {
    this._nodes.update(nodes => [...nodes, node]);
    
    // Sauvegarder l'état après modification
    this.saveState();
  }

  /**
   * Ajoute une nouvelle connexion au diagramme
   * @param connection La connexion à ajouter
   */
  addConnection(connection: Connection): void {
    this._connections.update(connections => [...connections, connection]);
    
    // Sauvegarder l'état après modification
    this.saveState();
  }

  /**
   * Crée un nœud par défaut
   */
  addDefaultNode(): void {
    // Vérifier si des nœuds existent déjà pour éviter la duplication
    if (this._nodes().length > 0) {
      console.log('Default nodes already exist, skipping creation');
      return;
    }
    
    console.log('Creating default nodes...');
    
    try {
      // Crée un nœud Client par défaut avec une position définie
      const clientNode: CrmNode = {
        id: generateGuid(),
        type: 'Client',
        text: 'Client 1',
        position: { x: 100, y: 100 },
        maxInputs: 0,
        maxOutputs: 1 
      };
      
      // Crée un nœud Task par défaut avec une position définie
      const taskNode: CrmNode = {
        id: generateGuid(),
        type: 'Task',
        text: 'Task 1',
        position: { x: 350, y: 100 },
        maxInputs: 1,
        maxOutputs: 1
      };
      
      // Ajoute les nœuds en une seule opération pour éviter les mises à jour partielles
      const newNodes = [clientNode, taskNode];
      
      // Log pour déboguer
      console.log('Nodes to be added:', JSON.stringify(newNodes));
      
      // Mise à jour des nœuds
      this._nodes.set(newNodes);
      
      // Vérification après mise à jour
      console.log('Nodes after update:', JSON.stringify(this._nodes()));
      
      // Crée une connexion entre les nœuds
      const connection: Connection = {
        id: generateGuid(),
        sourceId: `output_${clientNode.id}`,
        targetId: `input_${taskNode.id}`
      };
      
      // Ajoute la connexion
      this._connections.set([connection]);
      
      console.log('Default nodes created successfully:', newNodes);
      
      // Sauvegarder l'état APRÈS création des nœuds par défaut
      // et s'assurer que c'est le premier état dans l'historique
      if (this._nodes().length > 0) {
        setTimeout(() => {
          // Vider l'historique avant de sauvegarder l'état initial
          this.historyService.clear();
          // Puis sauvegarder l'état initial
          this.saveState();
        }, 0);
      }
    } catch (error) {
      console.error('Error creating default nodes:', error);
    }
  }

  /**
   * Vérifie si une position est libre (pas de nœud existant à cette position)
   */
  private isPositionFree(position: {x: number, y: number}): boolean {
    // Considérer une marge de 50px autour des nœuds existants
    const margin = 50;
    return !this._nodes().some(node => 
      Math.abs(node.position.x - position.x) < margin && 
      Math.abs(node.position.y - position.y) < margin
    );
  }

  /**
   * Nettoie les éléments temporaires
   */
  clearTemporaryElements(): void {
    // Ne déclencher de sauvegarde que si nous avions des éléments temporaires
    const hadTemporaryElements = 
      this._temporaryNodes().length > 0 || 
      this._temporaryConnections().length > 0;
    
    // Effacer les nœuds et connexions temporaires
    this._temporaryNodes.set([]);
    this._temporaryConnections.set([]);
    
    // Si nous avons supprimé des éléments temporaires, sauvegarder l'état
    if (hadTemporaryElements) {
      this.saveState();
    }
  }

  /**
   * Crée des nœuds temporaires pour les emplacements potentiels de connexion
   * @param itemType Le type d'élément en cours de drag
   */
  createTemporaryNodes(itemType: string): void {
    console.log('Creating temporary nodes for item type:', itemType);
    
    // D'abord, nettoyer les anciens nœuds temporaires
    this.clearTemporaryElements();
    
    // Pour chaque nœud existant, créer un nœud temporaire qui pourrait s'y connecter
    if (this._nodes().length === 0) {
      console.log('No existing nodes to create temporary connections to');
      
      // Créer un nœud temporaire au centre si aucun nœud n'existe
      const centralTempNode: CrmNode = {
        id: `temp_central_${generateGuid()}`,
        type: itemType,
        text: `${itemType} (Drop here)`,
        position: { x: 400, y: 300 },
        maxInputs: this.getDefaultMaxInputs(itemType),
        maxOutputs: this.getDefaultMaxOutputs(itemType)
      };
      
      this._temporaryNodes.set([centralTempNode]);
      return;
    }
    
    const tempNodes: CrmNode[] = [];
    const tempConnections: Connection[] = [];
    
    // Pour chaque nœud existant, appliquer la stratégie appropriée
    for (const existingNode of this._nodes()) {
      console.log('Creating temporary nodes around existing node:', existingNode.id);
      
      // Compter les connexions existantes pour ce nœud
      const existingOutputConnections = this._connections().filter(
        conn => conn.sourceId === `output_${existingNode.id}`
      );
      
      const existingInputConnections = this._connections().filter(
        conn => conn.targetId === `input_${existingNode.id}`
      );
      
      // Obtenir la stratégie appropriée pour ce nœud
      const strategy = this.strategyFactory.getStrategy(
        existingNode,
        existingOutputConnections,
        existingInputConnections,
        itemType
      );
      
      // Appliquer la stratégie pour créer des nœuds temporaires
      const result = strategy.createTemporaryNodes(
        existingNode,
        existingOutputConnections,
        existingInputConnections,
        itemType,
        (position) => this.isPositionFree(position),
        (type) => this.getDefaultMaxInputs(type),
        (type) => this.getDefaultMaxOutputs(type)
      );
      
      // Ajouter les nœuds et connexions temporaires
      tempNodes.push(...result.nodes);
      tempConnections.push(...result.connections);
    }
    
    console.log('Created temporary nodes:', tempNodes.length);
    this._temporaryNodes.set(tempNodes);
    this._temporaryConnections.set(tempConnections);
  }

  /**
   * Gère le drop sur un nœud temporaire
   * @param temporaryNodeId ID du nœud temporaire
   * @param changeDetectorRef Référence au détecteur de changements
   */
  handleDropOnTemporaryNode(temporaryNodeId: string, changeDetectorRef: ChangeDetectorRef): void {
    console.log('Dropped on temporary node:', temporaryNodeId);
    
    // Marquer que nous commençons la création d'un nœud
    this._isCreatingNode.set(true);
    
    if (!this._draggingItemType()) {
      this.clearTemporaryElements();
      this._isCreatingNode.set(false);
      return;
    }
    
    // Trouver le nœud temporaire concerné
    const temporaryNode = this._temporaryNodes().find(node => node.id === temporaryNodeId);
    if (!temporaryNode) {
      this.clearTemporaryElements();
      this._isCreatingNode.set(false);
      return;
    }
    
    // Trouver les connexions temporaires associées à ce nœud
    const relatedTemporaryConnections = this._temporaryConnections().filter(
      conn => conn.sourceId === `output_${temporaryNodeId}` || conn.targetId === `input_${temporaryNodeId}`
    );
    
    // Créer un nœud permanent à la place du nœud temporaire
    const permanentNode: CrmNode = {
      id: generateGuid(),
      type: this._draggingItemType()!,
      text: `${this._draggingItemType()} ${this._nodes().length + 1}`,
      position: { ...temporaryNode.position },
      maxInputs: temporaryNode.maxInputs,
      maxOutputs: temporaryNode.maxOutputs
    };
    
    // Ajouter le nœud permanent
    this.addNode(permanentNode);
    
    // Créer des connexions permanentes pour remplacer les temporaires
    for (const tempConn of relatedTemporaryConnections) {
      // Déterminer si le nœud temporaire est la source ou la cible
      const isSource = tempConn.sourceId.includes(temporaryNodeId);
      
      // Créer une connexion permanente en fonction de la position du nœud temporaire
      const permanentConnection: Connection = {
        id: generateGuid(),
        sourceId: isSource 
          ? `output_${permanentNode.id}` 
          : tempConn.sourceId,
        targetId: !isSource 
          ? `input_${permanentNode.id}` 
          : tempConn.targetId
      };
      
      this.addConnection(permanentConnection);
    }
    
    // Nettoyer les éléments temporaires
    this.clearTemporaryElements();
    
    // Réinitialiser l'état
    this._draggingItemType.set(null);
    
    // Supprimer tout élément de placeholder qui aurait pu être créé par le système de drag-and-drop de Foblex
    setTimeout(() => {
      const placeholders = document.querySelectorAll('.f-external-item-placeholder');
      placeholders.forEach(el => el.remove());
      
      // Force la mise à jour de la vue
      changeDetectorRef.detectChanges();
      
      // Réinitialiser le flag de création de nœud
      this._isCreatingNode.set(false);
    }, 50);
  }

  /**
   * Termine l'opération de drag
   * @param changeDetectorRef Référence au détecteur de changements
   */
  endDrag(changeDetectorRef: ChangeDetectorRef): void {
    console.log('Ending drag operation');
    
    // Nettoyer les éléments temporaires
    this.clearTemporaryElements();
    
    // Réinitialiser l'état
    this._draggingItemType.set(null);
    this._isCreatingNode.set(false);
    
    // Nettoyer les éléments visuels
    const placeholders = document.querySelectorAll('.f-external-item-placeholder');
    placeholders.forEach(el => el.remove());
    
    const previews = document.querySelectorAll('.f-external-item-preview');
    previews.forEach(el => el.remove());
    
    document.body.style.cursor = '';
    document.body.classList.remove('f-dragging');
    document.body.classList.remove('no-drop-allowed');
    
    // Force la mise à jour de la vue
    if (changeDetectorRef) {
      changeDetectorRef.detectChanges();
    }
  }

  /**
   * Retourne l'icône pour un type de nœud
   * @param type Type du nœud
   * @returns Icône à afficher
   */
  getNodeIcon(type: string): string {
    switch (type) {
      case 'Client':
        return '👤';
      case 'Contact':
        return '📞';
      case 'Task':
        return '📋';
      case 'Email':
        return '📧';
      case 'Meeting':
        return '🗓️';
      case 'BinarySplit':
        return '🔀';
      case 'MultiSplit':
        return '🔱';
      default:
        return '📄';
    }
  }

  /**
   * Retourne la classe CSS pour un type de nœud
   * @param type Type du nœud
   * @returns Classe CSS à appliquer
   */
  getNodeClass(type: string): string {
    let bgClass = '';
    const baseClasses = 'min-w-[180px] rounded-md shadow-md overflow-hidden';
    
    switch (type) {
      case 'Client':
        bgClass = 'bg-blue-500';
        break;
      case 'Contact':
        bgClass = 'bg-green-500';
        break;
      case 'Task':
        bgClass = 'bg-orange-500';
        break;
      case 'Email':
        bgClass = 'bg-purple-500';
        break;
      case 'Meeting':
        bgClass = 'bg-red-500';
        break;
      case 'BinarySplit':
        bgClass = 'bg-indigo-600';
        break;
      case 'MultiSplit':
        bgClass = 'bg-teal-600';
        break;
      default:
        bgClass = 'bg-gray-500';
    }
    
    return `${baseClasses} ${bgClass}`;
  }

  /**
   * Annule la dernière action
   */
  undo(): void {
    console.log('Undo requested');
    const previousState = this.historyService.undo();
    if (previousState) {
      this._nodes.set(previousState.nodes);
      this._connections.set(previousState.connections);
    }
  }

  /**
   * Rétablit l'action annulée
   */
  redo(): void {
    console.log('Redo requested');
    const nextState = this.historyService.redo();
    if (nextState) {
      this._nodes.set(nextState.nodes);
      this._connections.set(nextState.connections);
    }
  }

  /**
   * Sauvegarde l'état actuel dans l'historique
   */
  private saveState(): void {
    const currentState: FlowState = {
      nodes: this._nodes(),
      connections: this._connections()
    };
    this.historyService.pushState(currentState);
  }

  /**
   * Retourne le nombre maximum d'entrées autorisées par défaut pour un type de nœud
   * @param type Le type de nœud
   * @returns Le nombre maximum d'entrées
   */
  private getDefaultMaxInputs(type: string): number {
    switch (type) {
      case 'Client':
        return 1;  // Un client peut avoir une seule entrée
      case 'Contact':
        return 1;  // Un contact peut avoir une seule entrée
      case 'Task':
        return 5;  // Une tâche peut avoir jusqu'à 5 entrées
      case 'Email':
        return 2;  // Un email peut avoir jusqu'à 2 entrées
      case 'Meeting':
        return 3;  // Une réunion peut avoir jusqu'à 3 entrées
      case 'Call':
        return 2;  // Un appel peut avoir jusqu'à 2 entrées
      case 'Note':
        return 1;  // Une note peut avoir une seule entrée
      case 'BinarySplit':
        return 1;  // Un séparateur binaire a exactement 1 entrée
      case 'MultiSplit':
        return 1;  // Un séparateur multiple a exactement 1 entrée
      default:
        return 1;  // Par défaut, 1 entrée
    }
  }

  /**
   * Retourne le nombre maximum de sorties autorisées par défaut pour un type de nœud
   * @param type Le type de nœud
   * @returns Le nombre maximum de sorties
   */
  private getDefaultMaxOutputs(type: string): number {
    switch (type) {
      case 'Client':
        return 3;  // Un client peut avoir jusqu'à 3 sorties
      case 'Contact':
        return 2;  // Un contact peut avoir jusqu'à 2 sorties
      case 'Task':
        return 2;  // Une tâche peut avoir jusqu'à 2 sorties
      case 'Email':
        return 1;  // Un email peut avoir 1 sortie
      case 'Meeting':
        return 2;  // Une réunion peut avoir jusqu'à 2 sorties
      case 'Call':
        return 1;  // Un appel peut avoir 1 sortie
      case 'Note':
        return 0;  // Une note ne peut pas avoir de sortie
      case 'BinarySplit':
        return 2;  // Un séparateur binaire a exactement 2 sorties
      case 'MultiSplit':
        return 5;  // Un séparateur multiple peut avoir jusqu'à 5 sorties
      default:
        return 1;  // Par défaut, 1 sortie
    }
  }

  canConnect(source: string, target: string): boolean {
    // Vérifier les règles métier pour les connexions
    const sourceNodeId = source.replace('output_', '');
    const targetNodeId = target.replace('input_', '');
    
    const sourceNode = this._nodes().find(node => node.id === sourceNodeId);
    const targetNode = this._nodes().find(node => node.id === targetNodeId);

    if (!sourceNode || !targetNode) {
      return false;
    }

    // Vérifier si le nœud source est un output
    const isSourceOutput = source.startsWith('output_');
    // Vérifier si le nœud cible est un input
    const isTargetInput = target.startsWith('input_');

    // Vérifier que la connexion va d'un output vers un input
    if (!isSourceOutput || !isTargetInput) {
      return false;
    }

    const existingOutputs = this._connections().filter(conn => 
      conn.sourceId === source
    );
    
    const existingInputs = this._connections().filter(conn => 
      conn.targetId === target
    );

    // Règles spécifiques pour BinarySplit
    if (sourceNode.type === 'BinarySplit') {
      // Un BinarySplit ne peut avoir que 2 connexions de sortie
      if (existingOutputs.length >= 2) {
        return false;
      }
    }
    
    // Règles spécifiques pour MultiSplit
    if (sourceNode.type === 'MultiSplit') {
      // Un MultiSplit ne peut avoir que 5 connexions de sortie maximum
      if (existingOutputs.length >= 5) {
        return false;
      }
    }

    // Vérifier les limites générales d'entrées/sorties
    if (targetNode.maxInputs !== undefined && existingInputs.length >= targetNode.maxInputs) {
      return false;
    }

    if (sourceNode.maxOutputs !== undefined && existingOutputs.length >= sourceNode.maxOutputs) {
      return false;
    }

    // Vérifier si une connexion existe déjà entre ces deux ports
    const connectionExists = this._connections().some(
      conn => conn.sourceId === source && conn.targetId === target
    );

    if (connectionExists) {
      return false;
    }

    return true;
  }
} 