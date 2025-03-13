import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import {
  FExternalItemDirective,
  FExternalItemPlaceholderDirective,
  FExternalItemPreviewDirective
} from '@foblex/flow';
import { BuilderCategory, FlowStateService } from '../../services/flow-state.service';

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
export class BuilderComponent {
  private readonly flowStateService = inject(FlowStateService);
  
  // Utiliser computed() pour dériver des états
  protected readonly isOpen = computed(() => this.flowStateService.isBuilderOpen());
  protected readonly categories = computed(() => this.flowStateService.builderCategories());
  
  // Exposer des getters pour les classes conditionnelles
  protected readonly containerClasses = computed(() => ({
    'min-h-[60vh]': this.isOpen(),
    'h-12': !this.isOpen()
  }));

  protected readonly chevronClasses = computed(() => ({
    'rotate-180': !this.isOpen()
  }));
  
  @Output() itemDragStart = new EventEmitter<string>();
  @Output() itemDragEnd = new EventEmitter<void>();
  
  toggleCategory(category: BuilderCategory): void {
    this.flowStateService.toggleBuilderCategory(category.name);
  }
  
  toggle(): void {
    this.flowStateService.updateBuilderOpen(!this.isOpen());
  }
  
  onDragStart(itemType: string): void {
    console.log('Builder: drag started with item', itemType);
    this.itemDragStart.emit(itemType);
  }
  
  onDragEnd(): void {
    console.log('Builder: drag ended');
    this.itemDragEnd.emit();
  }
}