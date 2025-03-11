import { Component, ChangeDetectionStrategy, inject, signal, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { FlowService } from '../../services/flow.service';

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
 * Composant de toolbar flottant pour les actions sur le flow
 * Fournit des contrôles pour le zoom et d'autres actions
 */
@Component({
  selector: 'app-flow-toolbar',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe],
  templateUrl: './flow-toolbar.component.html',
  styleUrls: ['./flow-toolbar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlowToolbarComponent {
  /** Services injectés */
  private readonly flowService = inject(FlowService);
  private readonly destroyRef = inject(DestroyRef);
  
  /** Actions disponibles dans la toolbar */
  protected readonly actions = signal<ToolbarAction[]>([]);
  
  constructor() {
    // Initialisation du composant
    this.initializeActions();
    this.setupKeyboardShortcuts();
    
    // Utilisation d'effect pour les réactions aux changements
    effect(() => {
      console.log('Actions updated:', this.actions());
    });
  }
  
  /**
   * Initialise les actions disponibles dans la toolbar
   */
  private initializeActions(): void {
    this.actions.set([
      {
        id: 'zoomOut',
        label: 'Zoom Out',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15" />
              </svg>`,
        action: () => this.zoomOut(),
        tooltip: 'Réduire le zoom',
        shortcut: 'Ctrl + -'
      },
      {
        id: 'resetZoom',
        label: 'Reset Zoom',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
              </svg>`,
        action: () => this.resetZoom(),
        tooltip: 'Réinitialiser le zoom et centrer',
        shortcut: 'Ctrl + 0'
      },
      {
        id: 'zoomIn',
        label: 'Zoom In',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>`,
        action: () => this.zoomIn(),
        tooltip: 'Augmenter le zoom',
        shortcut: 'Ctrl + +'
      }
    ]);
  }
  
  /**
   * Configure les raccourcis clavier pour les actions de zoom
   */
  private setupKeyboardShortcuts(): void {
    const keydownHandler = (event: KeyboardEvent) => {
      // Vérifier si Ctrl (ou Cmd sur Mac) est enfoncé
      const ctrlKey = event.ctrlKey || event.metaKey;
      
      if (ctrlKey) {
        switch (event.key) {
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
    console.log('Zoom in requested');
    this.flowService.zoomIn();
  }
  
  /**
   * Diminue le niveau de zoom
   */
  zoomOut(): void {
    console.log('Zoom out requested');
    this.flowService.zoomOut();
  }
  
  /**
   * Réinitialise le zoom et centre le canvas
   */
  resetZoom(): void {
    console.log('Reset zoom requested');
    this.flowService.resetZoom();
  }
  
  /**
   * Exécute l'action associée à un bouton
   * @param action L'action à exécuter
   */
  executeAction(action: ToolbarAction): void {
    action.action();
  }
} 