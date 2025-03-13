import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BuilderComponent } from './components/builder/builder.component';
import { FlowContainerComponent } from './components/flow-container/flow-container.component';

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
}
