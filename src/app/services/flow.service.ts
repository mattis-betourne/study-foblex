import { Injectable, ChangeDetectorRef, signal, effect, inject } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { generateGuid } from '@foblex/utils';
import { CrmNode, Connection } from '../models/crm.models';
import { BehaviorSubject, Observable } from 'rxjs';
import { HistoryService, FlowState, FlowStateUpdater } from './history.service';
import { ZoomService } from './zoom.service';
import { TemporaryNodeService } from './temporary-node.service';
import { TemporaryNodeStrategyFactory } from '../strategies/temporary-node-strategies';

/**
 * Service responsable de la gestion du flow diagram (nœuds, connexions, etc.)
 */
@Injectable({
  providedIn: 'root'
})
export class FlowService implements FlowStateUpdater {
  // Signaux pour l'état principal
  private readonly _nodes = signal<CrmNode[]>([]);
  private readonly _connections = signal<Connection[]>([]);
  
  /**
   * Référence au composant canvas pour les opérations de zoom
   * @private
   */
  private _canvasRef: any = null;

  // Services injectés
  private readonly historyService = inject(HistoryService);
  private readonly zoomService = inject(ZoomService);
  private readonly temporaryNodeService = inject(TemporaryNodeService);

  // Observables pour les composants
  readonly nodes$ = toObservable(this._nodes);
  readonly connections$ = toObservable(this._connections);
  readonly temporaryNodes$ = this.temporaryNodeService.temporaryNodes$;
  readonly temporaryConnections$ = this.temporaryNodeService.temporaryConnections$;
  readonly draggingItemType$ = this.temporaryNodeService.draggingItemType$;
  readonly isCreatingNode$ = this.temporaryNodeService.isCreatingNode$;

  constructor() {
    // Enregistrer ce service comme FlowStateUpdater dans HistoryService
    this.historyService.registerFlowUpdater(this);
    
    // Initialiser les fonctions de support pour le service de nœuds temporaires
    this.temporaryNodeService.setSupport(
      this.isPositionFree.bind(this),
      this.getDefaultMaxInputs.bind(this),
      this.getDefaultMaxOutputs.bind(this),
      () => this._nodes(),
      () => this._connections()
    );

    // Capturer l'état initial après l'initialisation des données,
    // mais seulement si nous avons déjà des données
    setTimeout(() => {
      // Ne sauvegarder l'état initial que s'il y a effectivement des données
      if (this._nodes().length > 0 || this._connections().length > 0) {
        this.saveState();
      }
    }, 0);
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
    return this.temporaryNodeService.temporaryNodes;
  }

  /**
   * @returns Les connexions temporaires actuelles
   */
  get temporaryConnections(): Connection[] {
    return this.temporaryNodeService.temporaryConnections;
  }

  /**
   * @returns Le type d'élément en cours de drag
   */
  get draggingItemType(): string | null {
    return this.temporaryNodeService.draggingItemType;
  }

  /**
   * @param value Le type d'élément en cours de drag
   */
  set draggingItemType(value: string | null) {
    this.temporaryNodeService.draggingItemType = value;
  }

  /**
   * @returns Si un nœud est en cours de création
   */
  get isCreatingNode(): boolean {
    return this.temporaryNodeService.isCreatingNode;
  }

  /**
   * @param value Si un nœud est en cours de création
   */
  set isCreatingNode(value: boolean) {
    this.temporaryNodeService.isCreatingNode = value;
  }

  /**
   * Définit les nœuds du diagramme (pour l'historique)
   * @param nodes Les nœuds à définir
   */
  setNodes(nodes: CrmNode[]): void {
    this._nodes.set(nodes);
  }

  /**
   * Définit les connexions du diagramme (pour l'historique)
   * @param connections Les connexions à définir
   */
  setConnections(connections: Connection[]): void {
    this._connections.set(connections);
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
    this.zoomService.setZoomDirective(zoomDirective);
  }

  /**
   * Augmente le niveau de zoom
   * @param point Point central du zoom (optionnel)
   */
  zoomIn(point?: any): void {
    this.zoomService.zoomIn(point);
  }

  /**
   * Diminue le niveau de zoom
   * @param point Point central du zoom (optionnel)
   */
  zoomOut(point?: any): void {
    this.zoomService.zoomOut(point);
  }

  /**
   * Réinitialise le zoom et centre le canvas
   */
  resetZoom(): void {
    this.zoomService.resetZoom();
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
      // Crée un nœud Audience par défaut avec une position définie
      const audienceNode: CrmNode = {
        id: generateGuid(),
        type: 'Audience',
        text: 'Audience cible',
        position: { x: 100, y: 100 },
        maxInputs: 0,  // Pas d'entrée
        maxOutputs: 1  // 1 sortie maximum
      };
      
      // Ajoute le nœud
      const newNodes = [audienceNode];
      
      // Log pour déboguer
      console.log('Node to be added:', JSON.stringify(newNodes));
      
      // Mise à jour des nœuds
      this._nodes.set(newNodes);
      
      // Vérification après mise à jour
      console.log('Nodes after update:', JSON.stringify(this._nodes()));
      
      console.log('Default node created successfully:', newNodes);
      
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
   * Vérifie si une position est libre (pas de nœuds à proximité)
   * @param position Position à vérifier
   * @returns true si la position est libre
   * @private
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
    this.temporaryNodeService.clearTemporaryElements();
  }

  /**
   * Crée des nœuds temporaires pour les emplacements potentiels de connexion
   * @param itemType Le type d'élément en cours de drag
   */
  createTemporaryNodes(itemType: string): void {
    this.temporaryNodeService.createTemporaryNodes(itemType);
  }

  /**
   * Traite la fin d'un glisser-déposer sur un nœud temporaire
   * @param temporaryNodeId Identifiant du nœud temporaire
   * @param changeDetectorRef Référence au détecteur de changements
   */
  handleDropOnTemporaryNode(temporaryNodeId: string, changeDetectorRef: ChangeDetectorRef): void {
    const dropResult = this.temporaryNodeService.handleDropOnTemporaryNode(temporaryNodeId);
    
    if (!dropResult) {
      return;
    }
    
    const { nodeType, position, connections } = dropResult;
    
    // Générer un identifiant unique pour le nouveau nœud
    const newNodeId = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Créer le nouveau nœud
    const newNode: CrmNode = {
      id: newNodeId,
      type: nodeType,
      text: `New ${nodeType}`,
      position: position,
      maxInputs: this.getDefaultMaxInputs(nodeType),
      maxOutputs: this.getDefaultMaxOutputs(nodeType)
    };
    
    // Ajouter le nœud
    this.addNode(newNode);
    
    // Créer les connexions
    connections.forEach(conn => {
      // Déterminer si le nœud créé sera la source ou la cible
      const isNewNodeSource = conn.sourceId === '';
      const isNewNodeTarget = conn.targetId === '';
      
      // Préparer les identifiants en conservant le format input_/output_
      let source = isNewNodeSource ? `output_${newNodeId}` : conn.sourceId;
      let target = isNewNodeTarget ? `input_${newNodeId}` : conn.targetId;
      
      console.log(`Creating connection: ${source} -> ${target}`);
      
      // Générer un identifiant unique pour la connexion
      const connId = `conn-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Créer et ajouter la connexion
      const newConnection: Connection = {
        id: connId,
        sourceId: source,
        targetId: target
      };
      
      this.addConnection(newConnection);
    });
    
    // Forcer la mise à jour du composant
    if (changeDetectorRef) {
      changeDetectorRef.detectChanges();
    }
  }

  /**
   * Termine le glisser-déposer
   * @param changeDetectorRef Référence au détecteur de changements
   */
  endDrag(changeDetectorRef: ChangeDetectorRef): void {
    // Réinitialiser les états
    this.temporaryNodeService.draggingItemType = null;
    this.temporaryNodeService.isCreatingNode = false;
    this.clearTemporaryElements();
    
    // Forcer la mise à jour du composant
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
      // Targeting
      case 'Audience':
        return '👥';
        
      // Execution
      case 'BinarySplit':
        return '🔀';
      case 'MultiSplit':
        return '🔱';
      
      // Communication
      case 'Full Screen':
        return '📱';
      case 'SMS':
        return '💬';
      case 'Push':
        return '🔔';
      case 'Email':
        return '✉️';
      
      // Rewards
      case 'Freebet':
        return '🎁';
        
      // Fallback
      default:
        return '📄';
    }
  }

  /**
   * Retourne la classe CSS pour un type de nœud
   * Note: Cette méthode est conservée pour compatibilité avec d'anciennes parties du code
   * @param type Type du nœud
   * @returns Classe CSS à appliquer
   */
  getNodeClass(type: string): string {
    let bgClass = '';
    const baseClasses = 'min-w-[180px] rounded-md shadow-md overflow-hidden';
    
    switch (type) {
      // Targeting
      case 'Audience':
        bgClass = 'bg-yellow-500';
        break;
        
      // Execution
      case 'BinarySplit':
        bgClass = 'bg-indigo-600';
        break;
      case 'MultiSplit':
        bgClass = 'bg-teal-600';
        break;
      
      // Communication
      case 'Full Screen':
        bgClass = 'bg-blue-500';
        break;
      case 'SMS':
        bgClass = 'bg-green-500';
        break;
      case 'Push':
        bgClass = 'bg-purple-500';
        break;
      case 'Email':
        bgClass = 'bg-orange-500';
        break;
      
      // Rewards
      case 'Freebet':
        bgClass = 'bg-red-500';
        break;
        
      // Fallback
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
    this.historyService.undoAndUpdateFlow();
  }

  /**
   * Rétablit l'action annulée
   */
  redo(): void {
    console.log('Redo requested');
    this.historyService.redoAndUpdateFlow();
  }

  /**
   * Sauvegarde l'état actuel dans l'historique
   * @private
   */
  private saveState(): void {
    this.historyService.saveFlowState(this._nodes(), this._connections());
  }

  /**
   * Retourne le nombre maximum d'entrées autorisées par défaut pour un type de nœud
   * @param type Le type de nœud
   * @returns Le nombre maximum d'entrées
   */
  private getDefaultMaxInputs(type: string): number {
    switch (type) {
      // Targeting
      case 'Audience':
        return 0;  // Une audience n'a pas d'entrée
      
      // Execution
      case 'BinarySplit':
        return 1;  // Un séparateur binaire a exactement 1 entrée
      case 'MultiSplit':
        return 1;  // Un séparateur multiple a exactement 1 entrée
      
      // Communication
      case 'Full Screen':
        return 1;  // Une notification full screen a 1 entrée
      case 'SMS':
        return 1;  // Un SMS a 1 entrée
      case 'Push':
        return 1;  // Une notification push a 1 entrée
      case 'Email':
        return 1;  // Un email a 1 entrée
      
      // Rewards
      case 'Freebet':
        return 1;  // Un freebet a 1 entrée
      
      // Fallback
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
      // Targeting
      case 'Audience':
        return 1;  // Une audience a 1 sortie maximum
      
      // Execution
      case 'BinarySplit':
        return 2;  // Un séparateur binaire a exactement 2 sorties
      case 'MultiSplit':
        return 5;  // Un séparateur multiple peut avoir jusqu'à 5 sorties
      
      // Communication
      case 'Full Screen':
        return 1;  // Une notification full screen a 1 sortie
      case 'SMS':
        return 1;  // Un SMS a 1 sortie
      case 'Push':
        return 1;  // Une notification push a 1 sortie
      case 'Email':
        return 1;  // Un email a 1 sortie
      
      // Rewards
      case 'Freebet':
        return 1;  // Un freebet a 1 sortie
      
      // Fallback
      default:
        return 1;  // Par défaut, 1 sortie
    }
  }

  canConnect(source: string, target: string): boolean {
    // Vérifier que les arguments sont valides
    if (!source || !target) {
      return false;
    }

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