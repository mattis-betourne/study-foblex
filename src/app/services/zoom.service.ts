import { Injectable, signal, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FlowStateService } from './flow-state.service';

/**
 * Service dédié à la gestion des opérations de zoom
 * Respecte le principe de responsabilité unique (SRP)
 */
@Injectable({
  providedIn: 'root'
})
export class ZoomService {
  /**
   * Référence à la directive de zoom
   * @private
   */
  private readonly _zoomDirective = signal<any>(null);

  /**
   * Service d'état du flow
   * @private
   */
  private readonly flowStateService = inject(FlowStateService);

  /**
   * Minimum zoom level
   * @private
   */
  private readonly _minZoom = 0.1;

  /**
   * Maximum zoom level
   * @private
   */
  private readonly _maxZoom = 2;

  /**
   * Observable du niveau de zoom
   */
  readonly zoomLevel$ = toObservable(this.flowStateService.zoomLevel);

  /**
   * Valeur calculée indiquant si le zoom peut être augmenté
   */
  readonly canZoomIn = computed(() => this.flowStateService.zoomLevel() < this._maxZoom);

  /**
   * Valeur calculée indiquant si le zoom peut être diminué
   */
  readonly canZoomOut = computed(() => this.flowStateService.zoomLevel() > this._minZoom);

  /**
   * Observable indiquant si le zoom peut être augmenté
   */
  readonly canZoomIn$ = toObservable(this.canZoomIn);

  /**
   * Observable indiquant si le zoom peut être diminué
   */
  readonly canZoomOut$ = toObservable(this.canZoomOut);

  constructor() {}

  /**
   * Définit la référence à la directive de zoom
   * @param zoomDirective Référence à la directive de zoom
   */
  setZoomDirective(zoomDirective: any): void {
    this._zoomDirective.set(zoomDirective);
    
    // Initialiser le niveau de zoom actuel
    try {
      if (zoomDirective) {
        const currentZoom = zoomDirective.getZoomValue();
        this.flowStateService.updateZoom(currentZoom);
      }
    } catch (error) {
      console.error('Error getting initial zoom value:', error);
    }
  }

  /**
   * Retourne la directive de zoom actuelle
   */
  get zoomDirective(): any {
    return this._zoomDirective();
  }

  /**
   * Retourne le niveau de zoom actuel
   */
  get zoomLevel(): number {
    return this.flowStateService.zoomLevel();
  }

  /**
   * Augmente le niveau de zoom
   * @param point Point central du zoom (optionnel)
   */
  zoomIn(point?: any): void {
    if (!this._zoomDirective()) {
      console.warn('Zoom directive non disponible');
      return;
    }

    this._zoomDirective().zoomIn(point);
    
    // Mettre à jour le niveau de zoom
    try {
      const currentZoom = this._zoomDirective().getZoomValue();
      this.flowStateService.updateZoom(currentZoom, point);
    } catch (error) {
      console.error('Error updating zoom level:', error);
    }
  }

  /**
   * Diminue le niveau de zoom
   * @param point Point central du zoom (optionnel)
   */
  zoomOut(point?: any): void {
    if (!this._zoomDirective()) {
      console.warn('Zoom directive non disponible');
      return;
    }

    this._zoomDirective().zoomOut(point);
    
    // Mettre à jour le niveau de zoom
    try {
      const currentZoom = this._zoomDirective().getZoomValue();
      this.flowStateService.updateZoom(currentZoom, point);
    } catch (error) {
      console.error('Error updating zoom level:', error);
    }
  }

  /**
   * Réinitialise le zoom et centre le canvas
   */
  resetZoom(): void {
    if (!this._zoomDirective()) {
      console.warn('Zoom directive non disponible');
      return;
    }

    this._zoomDirective().reset();
    
    // Réinitialiser le niveau de zoom
    try {
      const currentZoom = this._zoomDirective().getZoomValue();
      this.flowStateService.updateZoom(currentZoom);
    } catch (error) {
      console.error('Error resetting zoom level:', error);
    }
  }
} 