import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import {
  FExternalItemDirective,
  FExternalItemPlaceholderDirective,
  FExternalItemPreviewDirective
} from '@foblex/flow';
import { BuilderCategory, FlowStateService } from '../../services/flow-state.service';
import { FlowService } from '../../services/flow.service';

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
  private readonly flowService = inject(FlowService);
  
  protected readonly isOpen = computed(() => this.flowStateService.isBuilderOpen());
  protected readonly categories = computed(() => this.flowStateService.builderCategories());
  
  protected readonly containerClasses = computed(() => ({
    'min-h-[60vh]': this.isOpen(),
    'h-12': !this.isOpen()
  }));

  protected readonly chevronClasses = computed(() => ({
    'rotate-180': !this.isOpen()
  }));
  
  toggleCategory(category: BuilderCategory): void {
    this.flowStateService.toggleBuilderCategory(category.name);
  }
  
  toggle(): void {
    this.flowStateService.updateBuilderOpen(!this.isOpen());
  }
  
  onDragStart(itemType: string): void {
    this.flowService.startDragging(itemType);
  }
  
  onDragEnd(): void {
    this.flowService.endDragging();
  }
}