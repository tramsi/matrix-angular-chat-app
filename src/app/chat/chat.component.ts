import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';
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

  onScroll(): void {
    const selectedRoom = this.matrixService.getSelectedRoom();
    if (selectedRoom) {
      this.matrixService.loadMoreMessages(selectedRoom.roomId).subscribe();
    }
  }

  onSendMessage(): void {
    if (this.newMessage.trim() === '') return;

    this.sendMessageSub = this.matrixService
      .sendMessage(this.newMessage)
      .subscribe(() => {
        this.newMessage = ''; // Clear the input field after sending
      });
  }

  onLeaveRoom(): void {
    this.leaveRoomSub = this.matrixService.leaveRoom().subscribe();
  }

  trackByMessageId(index: number, message: Message): number {
    return message.timestamp; // Use timestamp as a unique identifier
  }

  ngOnDestroy(): void {
    this.sendMessageSub?.unsubscribe();
    this.leaveRoomSub?.unsubscribe();
    this.matrixService.disconnect();
  }
}
