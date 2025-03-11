import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BuilderComponent } from './components/builder/builder.component';
import { FlowContainerComponent } from './components/flow-container/flow-container.component';
import { FlowService } from './services/flow.service';

/**
 * Composant principal de l'application
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    BuilderComponent,
    FlowContainerComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'study-foblex';
  
  /** État de la sidebar (ouvert par défaut) */
  isSidebarOpen = true;
  
  constructor(private flowService: FlowService) {}
  
  /**
   * Gère l'état de la sidebar
   * @param isOpen État d'ouverture de la sidebar
   */
  toggleSidebar(isOpen: boolean): void {
    this.isSidebarOpen = isOpen;
  }
  
  /**
   * Démarrer le drag d'un élément depuis le builder
   * @param itemType Type de l'élément en cours de drag
   */
  onItemDragStart(itemType: string): void {
    console.log('App component received itemDragStart event with type:', itemType);
    // Délègue au service, qui déclenchera une réaction dans le flow-container
    this.flowService.draggingItemType = itemType;
  }
  
  /**
   * Terminer le drag sans créer de nœud
   */
  onItemDragEnd(): void {
    // Le composant flow-container s'occupera de nettoyer via le service
  }
}
