import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { RoomsComponent } from './rooms/rooms.component';
import { ChatComponent } from './chat/chat.component';
import { MessageComponent } from './shared/components/message/message.component';
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';

@NgModule({
  declarations: [AppComponent, RoomsComponent, ChatComponent, MessageComponent],
  imports: [BrowserModule, FormsModule, InfiniteScrollDirective],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
