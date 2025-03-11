import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  FExternalItemDirective, 
  FExternalItemPlaceholderDirective, 
  FExternalItemPreviewDirective 
} from '@foblex/flow';

/**
 * Interface représentant une catégorie dans le Builder
 */
interface BuilderCategory {
  /** Nom de la catégorie */
  name: string;
  /** État d'expansion de la catégorie */
  expanded: boolean;
  /** Items contenus dans la catégorie */
  items: BuilderItem[];
}

/**
 * Interface représentant un item dans une catégorie du Builder
 */
interface BuilderItem {
  /** Type de l'item (Client, Task, etc.) */
  type: string;
  /** Icône Unicode utilisée pour l'item */
  icon: string;
  /** Classe de couleur CSS pour l'item */
  color: string;
}

/**
 * Composant pour la barre latérale de construction de flow
 */
@Component({
  selector: 'app-builder',
  standalone: true,
  imports: [
    CommonModule,
    FExternalItemDirective,
    FExternalItemPlaceholderDirective,
    FExternalItemPreviewDirective
  ],
  templateUrl: './builder.component.html',
  styleUrls: ['./builder.component.css']
})
export class BuilderComponent implements OnInit {
  /** État d'ouverture de la sidebar */
  @Input() isOpen = true;
  /** Événement émis lors du changement d'état de la sidebar */
  @Output() toggleSidebar = new EventEmitter<boolean>();
  /** Événement émis lors du début du drag d'un item */
  @Output() itemDragStart = new EventEmitter<string>();
  /** Événement émis lors de la fin du drag d'un item */
  @Output() itemDragEnd = new EventEmitter<void>();
  
  /** Catégories d'items disponibles dans le Builder */
  categories: BuilderCategory[] = [
    {
      name: 'Contacts',
      expanded: true,
      items: [
        { type: 'Client', icon: '👤', color: 'bg-blue-500' },
        { type: 'Contact', icon: '📞', color: 'bg-green-500' }
      ]
    },
    {
      name: 'Ventes',
      expanded: false,
      items: [
        { type: 'Deal', icon: '💰', color: 'bg-yellow-500' }
      ]
    },
    {
      name: 'Tâches',
      expanded: false,
      items: [
        { type: 'Task', icon: '✅', color: 'bg-red-500' },
        { type: 'Email', icon: '✉️', color: 'bg-purple-500' }
      ]
    },
    {
      name: 'Flux',
      expanded: true,
      items: [
        { type: 'BinarySplit', icon: '🔀', color: 'bg-indigo-600' },
        { type: 'MultiSplit', icon: '🔱', color: 'bg-teal-600' }
      ]
    }
  ];
  
  /**
   * Initialisation du composant
   */
  ngOnInit(): void {
    // S'assurer que le Builder est ouvert par défaut
    if (!this.isOpen) {
      this.isOpen = true;
      this.toggleSidebar.emit(this.isOpen);
    }
  }
  
  /**
   * Bascule l'état d'expansion d'une catégorie
   * @param category La catégorie à basculer
   */
  toggleCategory(category: BuilderCategory): void {
    category.expanded = !category.expanded;
  }
  
  /**
   * Bascule l'état d'ouverture de la sidebar
   */
  toggle(): void {
    this.isOpen = !this.isOpen;
    this.toggleSidebar.emit(this.isOpen);
  }
  
  /**
   * Méthode appelée au début du drag d'un item
   * @param itemType Le type d'item en cours de drag
   */
  onDragStart(itemType: string): void {
    console.log('Builder: drag started with item', itemType);
    this.itemDragStart.emit(itemType);
  }
  
  /**
   * Méthode appelée à la fin du drag d'un item
   */
  onDragEnd(): void {
    console.log('Builder: drag ended');
    this.itemDragEnd.emit();
  }
} 