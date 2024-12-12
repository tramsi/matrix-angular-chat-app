import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Observable, Subscription, filter } from 'rxjs';
import { MatrixService } from '../core/matrix.service';
import { Message, Room } from '../core/models';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit, OnDestroy {
  selectedRoom$: Observable<Room | null>;
  messages$: Observable<Message[]>;
  newMessage: string = '';
  private sendMessageSub: Subscription | null = null;
  private leaveRoomSub: Subscription | null = null;
  imagePreview: string = '';

  constructor(private matrixService: MatrixService) {
    this.selectedRoom$ = this.matrixService.selectedRoom$;
    this.messages$ = this.matrixService.messages$;
  }
  ngOnInit(): void {
    this.matrixService.initClient().subscribe({
      next: () => {
        console.log('Matrix client initialized successfully.');
      },
      error: (error) => {
        console.error('Error initializing Matrix client:', error);
      },
    });
  }

  onSendMessage(): void {
    if (this.newMessage.trim() === '' && !this.imagePreview) return;

    this.sendMessageSub = this.matrixService
      .sendMessage(this.newMessage, this.imagePreview)
      .subscribe(() => {
        this.newMessage = ''; // Clear the input field after sending
        this.imagePreview = ''; // Clear the image preview
      });
  }

  onLeaveRoom(): void {
    this.leaveRoomSub = this.matrixService.leaveRoom().subscribe();
  }

  trackByMessageId(index: number, message: Message): number {
    return message.timestamp; // Use timestamp as a unique identifier
  }

  onFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      this.matrixService.uploadImage(file).subscribe({
        next: (imageUrl) => {
          console.log('Image URL:', imageUrl);
          this.imagePreview = imageUrl;
        },
        error: (error) => {
          console.error('Error uploading image:', error);
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.sendMessageSub?.unsubscribe();
    this.leaveRoomSub?.unsubscribe();
    this.matrixService.disconnect();
  }
}
