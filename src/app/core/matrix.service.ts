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
  of,
  merge,
  mergeMap,
  switchMap,
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
} from 'matrix-js-sdk';
import { Room, Message } from './models';
import { MATRIX_CONFIG } from './matrix.config';
import { RoomMessageEventContent } from 'matrix-js-sdk/lib/types';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root',
})
export class MatrixService {
  private client: MatrixClient | null = null;

  private roomsSubject = new BehaviorSubject<Room[]>([]);
  public rooms$ = this.roomsSubject.asObservable();

  private selectedRoomSubject = new BehaviorSubject<Room | null>(null);
  public selectedRoom$ = this.selectedRoomSubject.asObservable();

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

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
    this.client.on(RoomEvent.Timeline, (event: MatrixEvent) => {
      if (event.getType() === 'm.room.message') {
        const message: Message = {
          sender: event.getSender() || '',
          content: event.getContent()['body'] || '',
          timestamp: event.getTs(),
          type: event.getContent()['msgtype'],
          media: event.getContent()['url']
            ? [
                {
                  url: event.getContent()['url'],
                  type: 'image',
                },
              ]
            : [],
        };
        this.messagesSubject.next([...this.messagesSubject.value, message]);
      }
    });

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
    const initialMessages: Message[] = events
      .filter((event) => event.getType() === 'm.room.message')
      .map((event) => ({
        sender: event.getSender() || '',
        content: event.getContent()['body'] || '',
        timestamp: event.getTs(),
        type: event.getContent()['msgtype'],
        media: event.getContent()['url']
          ? [
              {
                url: event.getContent()['url'],
                type: 'image',
              },
            ]
          : [],
      }));

    this.messagesSubject.next(initialMessages);
  }

  // Send a message to the currently selected room
  public sendMessage(content: string, imageUrl?: string): Observable<void> {
    const selectedRoom = this.selectedRoomSubject.value;
    if (!this.client || !selectedRoom) {
      return throwError(() => 'No selected room or client not initialized');
    }

    const eventContent: RoomMessageEventContent = imageUrl
      ? {
          msgtype: MsgType.Image,
          body: content || 'Image',
          url: imageUrl,
          info: {
            mimetype: 'image/jpeg',
          },
        }
      : {
          msgtype: MsgType.Text,
          body: content,
        };

    return from(
      this.client.sendEvent(
        selectedRoom.roomId,
        EventType.RoomMessage,
        eventContent,
        ''
      )
    ).pipe(
      map(() => {
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

  // Upload an image
  public uploadImage(file: File): Observable<string> {
    if (!this.client) {
      return throwError(() => new Error('Matrix client not initialized'));
    }

    return new Observable<string>((observer) => {
      this.client
        ?.uploadContent(file, {
          type: file.type,
        })
        .then((response) => {
          console.log('Image uploaded:', response);
          const imageUrl = response.content_uri;
          observer.next(imageUrl || '');
          observer.complete();
        })
        .catch((error) => {
          observer.error(error);
        });
    });
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

  mxcToHttp(
    mxcUrl: string,
    width?: number,
    height?: number,
    resizeMethod?: string
  ): string | null {
    if (!this.client) {
      console.error('Matrix client is not initialized.');
      return '';
    }

    // Check if width, height, and resizeMethod are provided
    if (width && height && resizeMethod) {
      return this.client.mxcUrlToHttp(
        mxcUrl,
        width,
        height,
        resizeMethod,
        false,
        true,
        true
      );
    } else {
      return this.client.mxcUrlToHttp(
        mxcUrl,
        undefined,
        undefined,
        undefined,
        false,
        true,
        true
      );
    }
  }

  getMediaContent(mxcUrl: string): Observable<SafeResourceUrl> {
    if (!this.client) {
      console.error('Matrix client is not initialized.');
      return throwError(() => new Error('Matrix client not initialized'));
    }

    const thumbnailUrl = this.mxcToHttp(mxcUrl);

    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.client.getAccessToken()}`,
    });

    return this.http
      .get(thumbnailUrl as string, {
        headers,
        responseType: 'blob', // Directly get the response as a blob
      })
      .pipe(
        switchMap((blob) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob); // convert blob to base64

          // Return an observable that emits the result when the FileReader has finished
          return fromEvent(reader, 'loadend').pipe(
            map(() => {
              const base64Data = reader.result as string;
              return this.sanitizer.bypassSecurityTrustResourceUrl(base64Data);
            })
          );
        }),
        catchError((error) => {
          console.error('Error fetching media content:', error);
          return throwError(() => error); // Re-throw the error after logging
        })
      );
  }
}
