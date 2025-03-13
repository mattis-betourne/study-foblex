import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BuilderComponent } from './components/builder/builder.component';
import { FlowContainerComponent } from './components/flow-container/flow-container.component';
import { FlowService } from './services/flow.service';

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
  private readonly flowService = inject(FlowService);
  
  onItemDragStart(itemType: string): void {
    this.flowService.startDragging(itemType);
  }
  
  onItemDragEnd(): void {
    this.flowService.endDragging();
  }
}
