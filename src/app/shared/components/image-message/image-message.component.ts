import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
} from '@angular/core';
import { MatrixService } from '../../../core/matrix.service';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-image-message',
  template: ` <img *ngIf="imageUrl" [src]="imageUrl" alt="Image" /> `,
  styleUrls: ['./image-message.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageMessageComponent implements OnInit {
  @Input() mxcUrl!: string;
  imageUrl: SafeResourceUrl | null = null;

  constructor(
    private matrixService: MatrixService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (this.mxcUrl) {
      this.matrixService.getMediaContent(this.mxcUrl).subscribe({
        next: (url) => {
          this.imageUrl = url;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.log(error);
        },
      });
    }
  }
}
