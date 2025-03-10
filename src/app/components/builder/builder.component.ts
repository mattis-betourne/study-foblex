import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  FExternalItemDirective, 
  FExternalItemPlaceholderDirective, 
  FExternalItemPreviewDirective 
} from '@foblex/flow';

interface BuilderCategory {
  name: string;
  expanded: boolean;
  items: BuilderItem[];
}

interface BuilderItem {
  type: string;
  icon: string;
  color: string;
}

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
  @Input() isOpen = true;
  @Output() toggleSidebar = new EventEmitter<boolean>();
  @Output() itemDragStart = new EventEmitter<string>();
  @Output() itemDragEnd = new EventEmitter<void>();
  
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
    }
  ];
  
  ngOnInit(): void {
    // S'assurer que le Builder est ouvert par défaut
    if (!this.isOpen) {
      this.isOpen = true;
      this.toggleSidebar.emit(this.isOpen);
    }
  }
  
  toggleCategory(category: BuilderCategory): void {
    category.expanded = !category.expanded;
  }
  
  toggle(): void {
    this.isOpen = !this.isOpen;
    this.toggleSidebar.emit(this.isOpen);
  }
  
  // Méthode pour démarrer le drag d'un élément
  onDragStart(itemType: string): void {
    console.log('Builder: drag started with item', itemType);
    this.itemDragStart.emit(itemType);
    
    // Ajouter un petit délai pour s'assurer que l'event est bien propagé
    setTimeout(() => {
      // Émettre à nouveau l'événement pour s'assurer qu'il est bien reçu
      this.itemDragStart.emit(itemType);
    }, 100);
  }
  
  // Méthode pour terminer le drag d'un élément
  onDragEnd(): void {
    console.log('Builder: drag ended');
    this.itemDragEnd.emit();
  }
} 