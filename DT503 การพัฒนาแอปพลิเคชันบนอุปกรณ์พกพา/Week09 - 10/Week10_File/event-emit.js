const EventEmitter = require('events');
const myService = new EventEmitter();

setImmediate(()=>{
  myService.emit('registration',{
      name: "Suchada",
      email: "suchada@email.com"
    })
});

myService.on('registration', (userData) => {
  console.log(`Email sent to ${userData.name} address: ${userData.email}`);
});

myService.on('registration', (userData)=>{
  console.log(`New member: ${userData.name}$`);
});
