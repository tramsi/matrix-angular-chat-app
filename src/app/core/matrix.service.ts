import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  from,
  fromEvent,
  map,
  tap,
  forkJoin,
  throwError,
  catchError,
  take,
} from 'rxjs';
import {
  MatrixClient,
  createClient,
  Room as MatrixRoom,
  MatrixEvent,
  TimelineEvents,
  RoomEvent,
  ISendEventResponse,
  EventType,
  MsgType,
  ClientEvent,
  EventTimeline,
} from 'matrix-js-sdk';
import { Room, Message } from './models';
import { MATRIX_CONFIG } from './matrix.config';
import { RoomMessageEventContent } from 'matrix-js-sdk/lib/types';

@Injectable({
  providedIn: 'root',
})
export class MatrixService {
  private client: MatrixClient | null = null;

  private roomsSubject = new BehaviorSubject<Room[]>([]);
  public rooms$ = this.roomsSubject.asObservable();

  private selectedRoomSubject = new BehaviorSubject<Room | null>(null);
  public selectedRoom$ = this.selectedRoomSubject.asObservable();

  getSelectedRoom(): Room | null {
    return this.selectedRoomSubject.value;
  }

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  constructor() {}

  // Initialize the Matrix client
  public initClient(): Observable<void> {
    this.client = createClient({
      baseUrl: MATRIX_CONFIG.baseUrl,
      accessToken: MATRIX_CONFIG.accessToken,
      userId: MATRIX_CONFIG.userId,
    });

    fromEvent<string[]>(
      this.client,
      ClientEvent.Sync,
      (state: string[]) => state
    )
      .pipe(
        take(1) // Use takeWhile to control the listener
      )
      .subscribe((state) => {
        if (state?.includes('PREPARED')) {
          this.loadRooms();
        }
      });

    // Listen for incoming room timelines
    this.client.on(
      RoomEvent.Timeline,
      (event: MatrixEvent, room: MatrixRoom | undefined) => {
        if (
          event.getType() === 'm.room.message' &&
          room?.roomId === this.selectedRoomSubject.value?.roomId
        ) {
          const message: Message = {
            sender: event.getSender() || '',
            content: event.getContent()['body'] || '',
            timestamp: event.getTs(),
          };
          this.messagesSubject.next([...this.messagesSubject.value, message]);
        }
      }
    );

    // Start the client
    return from(this.client.startClient({ initialSyncLimit: 20 })).pipe(
      catchError((error) => {
        console.error('Error starting Matrix client:', error);
        return throwError(() => 'Failed to start Matrix client');
      })
    );
  }

  // Load rooms the user is a member of
  public loadRooms(): void {
    if (!this.client) {
      console.error('Matrix client is not initialized.');
      return;
    }

    // Get rooms directly (no RxJS operators needed)
    const rooms = this.client.getRooms();

    // Map Room objects to your Room model
    const mappedRooms: Room[] = rooms.map((room: MatrixRoom) => ({
      roomId: room.roomId,
      name: room.name || 'No Name', // Provide a default name if needed
      // ... other properties you want to map
    }));

    this.roomsSubject.next(mappedRooms);
  }

  // Join a specific room
  public joinRoom(roomIdOrAlias: string): Observable<void> {
    if (!this.client)
      return throwError(() => new Error('Matrix client not initialized'));

    return from(this.client.joinRoom(roomIdOrAlias)).pipe(
      tap(() => this.loadRooms()), // Refresh rooms after joining
      map(() => void 0), // Convert to void observable,
      catchError((error) => {
        console.error(`Error joining room ${roomIdOrAlias}:`, error);
        return throwError(() => `Failed to join room ${roomIdOrAlias}`);
      })
    );
  }

  // Select a room and load its messages
  public selectRoom(room: Room): void {
    this.selectedRoomSubject.next(room);
    this.loadRoomMessages(room.roomId);
  }

  // Load messages for a specific room
  private loadRoomMessages(roomId: string): void {
    if (!this.client) {
      console.error('Matrix client is not initialized.');
      return;
    }

    const room = this.client.getRoom(roomId);
    if (!room) return;

    // Fetch initial messages
    const timeline = room.getLiveTimeline();
    const events = timeline.getEvents();
    const initialMessages = events
      .filter((event) => event.getType() === 'm.room.message')
      .map((event) => ({
        sender: event.getSender() || '',
        content: event.getContent()['body'] || '',
        timestamp: event.getTs(),
      }));

    this.messagesSubject.next(initialMessages);
  }

  public loadMoreMessages(
    roomId: string,
    limit: number = 30
  ): Observable<void> {
    if (!this.client) return throwError(() => 'Matrix client not initialized');

    const room = this.client.getRoom(roomId);
    if (!room) return throwError(() => `Room ${roomId} not found`);

    const liveTimeline = room.getLiveTimeline();

    return from(
      this.client.paginateEventTimeline(liveTimeline, {
        backwards: true,
        limit: limit,
      })
    ).pipe(
      tap(() => {
        // Get the events from the timeline after pagination
        const events = liveTimeline.getEvents();

        // Map MatrixEvents to your Message model
        const newMessages = events
          .filter((event) => event.getType() === 'm.room.message')
          .map((event) => ({
            sender: event.getSender() || '',
            content: event.getContent()['body'] || '',
            timestamp: event.getTs(),
          }));

        // Update the messages subject with the new messages prepended to the existing ones
        this.messagesSubject.next([
          ...newMessages,
          ...this.messagesSubject.value,
        ]);
      }),
      map(() => void 0), // Convert to void Observable
      catchError((error) => {
        console.error('Error loading more messages:', error);
        return throwError(() => 'Failed to load more messages');
      })
    );
  }

  // Send a message to the currently selected room
  public sendMessage(message: string): Observable<void> {
    const selectedRoom = this.selectedRoomSubject.value;
    if (!this.client || !selectedRoom) {
      return throwError(() => 'No selected room or client not initialized');
    }

    const content: RoomMessageEventContent = {
      body: message,
      msgtype: MsgType.Text,
    };

    return from(
      this.client.sendEvent(
        selectedRoom.roomId,
        EventType.RoomMessage,
        content,
        ''
      )
    ).pipe(
      map(() => {
        // Map to void since we don't need the ISendEventResponse
        return;
      }),
      catchError((error) => {
        console.error('Error sending message:', error);
        return throwError(() => 'Failed to send message');
      })
    );
  }

  // Leave the currently selected room
  public leaveRoom(): Observable<void> {
    const selectedRoom = this.selectedRoomSubject.value;
    if (!this.client || !selectedRoom)
      return throwError(() => 'No selected room or client not initialized');

    return from(this.client.leave(selectedRoom.roomId)).pipe(
      tap(() => {
        this.loadRooms(); // Refresh the room list
        this.selectedRoomSubject.next(null); // Clear selected room
        this.messagesSubject.next([]); // Clear messages
      }),
      map(() => void 0), // Convert to void observable
      catchError((error) => {
        console.error('Error leaving room:', error);
        return throwError(() => 'Failed to leave room');
      })
    );
  }

  // Clean up resources
  public disconnect(): void {
    if (this.client) {
      this.client.stopClient();
      this.client = null;
    }
    this.roomsSubject.complete();
    this.selectedRoomSubject.complete();
    this.messagesSubject.complete();
  }
}
