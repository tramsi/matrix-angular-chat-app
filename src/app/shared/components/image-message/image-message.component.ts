import { Component, Input, OnInit } from '@angular/core';
import { MatrixService } from '../../../core/matrix.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-message',
  template: ` <img *ngIf="imageUrl" [src]="imageUrl" alt="Image" /> `,
  styleUrls: ['./image-message.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class ImageMessageComponent implements OnInit {
  @Input() mxcUrl!: string;
  imageUrl: string | null = null;

  constructor(private matrixService: MatrixService) {}

  ngOnInit() {
    if (this.mxcUrl) {
      this.matrixService.getMediaContent(this.mxcUrl).subscribe({
        next: (blob) => {
          this.imageUrl = URL.createObjectURL(blob);
        },
        error: (error) => {
          console.error('Error loading image:', error);
        }
      });
    }
  }

  ngOnDestroy() {
    // Clean up the object URL to prevent memory leaks
    if (this.imageUrl) {
      URL.revokeObjectURL(this.imageUrl);
    }
  }
}
