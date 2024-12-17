import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit, OnDestroy {
  selectedRoom$: Observable<Room | null>;
  messages$: Observable<Message[]>;
  newMessage: string = '';
  private sendMessageSub: Subscription | null = null;
  private leaveRoomSub: Subscription | null = null;
  imagePreview: string = '';

  constructor(
    private matrixService: MatrixService,
    private cdr: ChangeDetectorRef
  ) {
    this.selectedRoom$ = this.matrixService.selectedRoom$;
    this.messages$ = this.matrixService.messages$;
  }
  ngOnInit(): void {
    this.matrixService.initClient().subscribe({
      next: () => {
        this.handleServiceWorker();
        console.log('Matrix client initialized successfully.');
      },
      error: (error) => {
        console.error('Error initializing Matrix client:', error);
      },
    });
  }

  handleServiceWorker(): void {
    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
      // Register the service worker
      navigator.serviceWorker
        .register('/service-worker.js') // Path to your service worker file
        .then((registration) => {
          console.log(
            '[Client] Service Worker registered with scope:',
            registration.scope
          );

          // Listen for messages from the service worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            const { data } = event;

            // Check if it's an auth request from the service worker
            if (data.type === 'authRequest') {
              console.log(
                `[Client] Received auth request from service worker, requestId: ${data.requestId}`
              );
              const accessToken = this.matrixService.getAccessToken();

              // Respond to the service worker with the auth data
              // event.source is the service worker that sent the message
              if (event.source) {
                if (accessToken) {
                  event.source.postMessage({
                    type: 'authResponse',
                    requestId: data.requestId,
                    accessToken: accessToken,
                  });
                } else {
                  event.source.postMessage({
                    type: 'authResponse',
                    requestId: data.requestId,
                    error: 'No access token available',
                  });
                }
              }
            }
          });
        })
        .catch((error) => {
          console.error('[Client] Service Worker registration failed:', error);
        });
    }
  }
  onSendMessage(): void {
    if (this.newMessage.trim() === '' && !this.imagePreview) return;

    this.sendMessageSub = this.matrixService
      .sendMessage(this.newMessage, this.imagePreview)
      .subscribe(() => {
        this.newMessage = ''; // Clear the input field after sending
        this.imagePreview = ''; // Clear the image preview
        this.cdr.markForCheck();
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
          this.imagePreview = imageUrl;
          this.cdr.markForCheck();
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
