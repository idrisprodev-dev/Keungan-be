import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get() // Endpoint ini akan merespons request GET di http://localhost:3000/
  getHello() {
    return this.appService.checkDatabaseStatus();
  }
}