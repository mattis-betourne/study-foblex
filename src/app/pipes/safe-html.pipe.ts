import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Pipe pour sécuriser l'affichage de HTML brut
 * Permet d'afficher des icônes SVG en toute sécurité
 */
@Pipe({
  name: 'safeHtml',
  standalone: true
})
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Transforme une chaîne HTML en HTML sécurisé
   * @param value La chaîne HTML à sécuriser
   * @returns Le HTML sécurisé
   */
  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
} 