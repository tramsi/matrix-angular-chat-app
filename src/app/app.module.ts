import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { AppComponent } from './app.component';
import { RoomsComponent } from './rooms/rooms.component';
import { ChatComponent } from './chat/chat.component';
import { MessageComponent } from './shared/components/message/message.component';
import { ImageMessageComponent } from './shared/components/image-message/image-message.component';
import { ServiceWorkerModule } from '@angular/service-worker';

@NgModule({
  declarations: [AppComponent, RoomsComponent, ChatComponent],
  imports: [
    BrowserModule,
    FormsModule,
    MessageComponent,
    ImageMessageComponent,
    // ServiceWorkerModule.register('service-worker.js', {
    //   enabled: !isDevMode(),
    //   // Register the ServiceWorker as soon as the application is stable
    //   // or after 30 seconds (whichever comes first).
    //   registrationStrategy: 'registerWhenStable:30000',
    // }),
  ],
  providers: [provideHttpClient(withFetch())],
  bootstrap: [AppComponent],
})
export class AppModule {}
