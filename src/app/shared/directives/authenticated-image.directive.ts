import {
  Directive,
  Input,
  ElementRef,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MATRIX_CONFIG } from '../../core/matrix.config';

@Directive({
  selector: '[appAuthenticatedImage]',
  standalone: true,
})
export class AuthenticatedImageDirective implements OnInit, OnChanges {
  @Input('appAuthenticatedImage') imageUrl: string | null | undefined = ''; // Input for the image URL

  constructor(private el: ElementRef, private http: HttpClient) {}

  ngOnInit(): void {
    console.log('AuthenticatedImageDirective initialized', this.imageUrl);
    this.loadImage();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageUrl'] && !changes['imageUrl'].firstChange) {
      this.loadImage();
    }
  }

  private loadImage(): void {
    if (!this.imageUrl) {
      return; // Or handle the case where the image URL is not provided
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${MATRIX_CONFIG.accessToken}`,
    });

    this.http.get(this.imageUrl, { headers, responseType: 'blob' }).subscribe(
      (blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          this.el.nativeElement.src = reader.result; // Set the src of the host img element
        };
        reader.readAsDataURL(blob);
      },
      (error) => {
        console.error('Error loading image:', error);
        // Optionally, set a placeholder image or handle the error in another way
      }
    );
  }
}
