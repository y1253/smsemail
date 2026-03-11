import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService:UsersService
    ){}

      @Post('create')
  async postUser( @Body() newUser:any) {

    return(await this.usersService.createNewUser(newUser));
     
  }

  @Post('login')
  async login(@Body() user:{email:string,password:string}){
    return await this.usersService.login(user);
  }

  @Post('google')
  async postGoogleUser(@Body('credential') credential:string){
    
    return this.usersService.googleLogin(credential);
  }

}
