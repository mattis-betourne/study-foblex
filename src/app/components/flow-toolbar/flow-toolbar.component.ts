import { Component, ChangeDetectionStrategy, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { FlowService } from '../../services/flow.service';
import { HistoryService, FlowState } from '../../services/history.service';
import { ZoomService } from '../../services/zoom.service';

/**
 * Interface pour les actions de la toolbar
 */
interface ToolbarAction {
  /** Identifiant unique de l'action */
  id: string;
  /** Libellé de l'action */
  label: string;
  /** Icône SVG de l'action */
  icon: string;
  /** Fonction à exécuter lors du clic */
  action: () => void;
  /** Texte d'aide (tooltip) */
  tooltip: string;
  /** Raccourci clavier */
  shortcut?: string;
  /** Classe CSS additionnelle */
  class?: string;
}

/**
 * Composant pour la barre d'outils flottante du flow diagram
 */
@Component({
  selector: 'app-flow-toolbar',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe],
  templateUrl: './flow-toolbar.component.html',
  styleUrls: ['./flow-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlowToolbarComponent {
  /** Services injectés */
  private readonly historyService = inject(HistoryService);
  private readonly zoomService = inject(ZoomService);
  private readonly destroyRef = inject(DestroyRef);

  /** Actions disponibles dans la toolbar */
  protected readonly actions = signal<ToolbarAction[]>([]);
  
  /** États dérivés des services pour les actions */
  protected readonly canUndo = this.historyService.canUndo;
  protected readonly canRedo = this.historyService.canRedo;
  protected readonly canZoomIn = this.zoomService.canZoomIn;
  protected readonly canZoomOut = this.zoomService.canZoomOut;

  constructor() {
    this.initializeActions();
    this.setupKeyboardShortcuts();
  }

  /**
   * Initialise les actions disponibles dans la toolbar
   */
  private initializeActions(): void {
    const actionsList: ToolbarAction[] = [
      {
        id: 'undo',
        label: 'Annuler',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a6 6 0 010 12H11"/></svg>',
        action: () => this.undo(),
        tooltip: 'Annuler la dernière action',
        shortcut: 'Ctrl+Z',
        class: 'undo-action'
      },
      {
        id: 'redo',
        label: 'Rétablir',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a6 6 0 100 12H13"/></svg>',
        action: () => this.redo(),
        tooltip: 'Rétablir la dernière action annulée',
        shortcut: 'Ctrl+Y',
        class: 'redo-action'
      },
      {
        id: 'zoom-in',
        label: 'Zoom avant',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
        action: () => this.zoomIn(),
        tooltip: 'Zoom avant',
        shortcut: 'Ctrl++',
        class: 'zoom-action'
      },
      {
        id: 'zoom-out',
        label: 'Zoom arrière',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
        action: () => this.zoomOut(),
        tooltip: 'Zoom arrière',
        shortcut: 'Ctrl+-',
        class: 'zoom-action'
      },
      {
        id: 'reset-zoom',
        label: 'Réinitialiser le zoom',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
        action: () => this.resetZoom(),
        tooltip: 'Réinitialiser le zoom',
        shortcut: 'Ctrl+0',
        class: 'zoom-action'
      }
    ];

    this.actions.set(actionsList);
  }

  /**
   * Configure les raccourcis clavier
   */
  private setupKeyboardShortcuts(): void {
    const keydownHandler = (event: KeyboardEvent) => {
      const { ctrlKey, key } = event;
      
      if (ctrlKey) {
        switch (key) {
          case 'z':
            event.preventDefault();
            this.undo();
            break;
          case 'y':
            event.preventDefault();
            this.redo();
            break;
          case '+':
          case '=': // Le signe égal est sur la même touche que le plus sur les claviers QWERTY
            event.preventDefault();
            this.zoomIn();
            break;
          case '-':
            event.preventDefault();
            this.zoomOut();
            break;
          case '0':
            event.preventDefault();
            this.resetZoom();
            break;
        }
      }
    };
    
    document.addEventListener('keydown', keydownHandler);
    
    // Nettoyage automatique lors de la destruction du composant
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', keydownHandler);
    });
  }

  /**
   * Augmente le niveau de zoom
   */
  zoomIn(): void {
    this.zoomService.zoomIn();
  }

  /**
   * Diminue le niveau de zoom
   */
  zoomOut(): void {
    this.zoomService.zoomOut();
  }

  /**
   * Réinitialise le zoom et centre le canvas
   */
  resetZoom(): void {
    this.zoomService.resetZoom();
  }
  
  /**
   * Annule la dernière action
   */
  undo(): void {
    if (this.canUndo()) {
      console.log('Executing undo action');
      this.historyService.undoAndUpdateFlow();
    } else {
      console.log('Undo action not available');
    }
  }
  
  /**
   * Rétablit la dernière action annulée
   */
  redo(): void {
    if (this.canRedo()) {
      console.log('Executing redo action');
      this.historyService.redoAndUpdateFlow();
    } else {
      console.log('Redo action not available');
    }
  }

  /**
   * Exécute l'action associée à un bouton
   * @param action L'action à exécuter
   */
  executeAction(action: ToolbarAction): void {
    // Vérifier si l'action est disponible avant de l'exécuter
    if (action.id === 'undo' && !this.canUndo()) {
      console.log('Cannot execute undo action: not available');
      return;
    }
    
    if (action.id === 'redo' && !this.canRedo()) {
      console.log('Cannot execute redo action: not available');
      return;
    }
    
    if (action.id === 'zoom-in' && !this.canZoomIn()) {
      console.log('Cannot execute zoom in action: already at max zoom');
      return;
    }
    
    if (action.id === 'zoom-out' && !this.canZoomOut()) {
      console.log('Cannot execute zoom out action: already at min zoom');
      return;
    }
    
    // Exécuter l'action
    action.action();
  }
} 