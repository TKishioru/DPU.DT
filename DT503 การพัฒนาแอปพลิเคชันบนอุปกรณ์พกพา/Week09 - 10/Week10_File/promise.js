const p = new Promise (function(resolve,reject){
        setTimeout(function(){
            //resolve({id:1,"name":"Suchada"});
            reject(new Error('Error 404 Bad Request'));
       },2000);
    });
    console.log('Before Asynchronous Operation');
    
    p.then(function(result){
        console.log('This is result: ',result);
    })
    .catch(function(err){
        console.log(err.message);
    });
    
    console.log('After Asynchronous Operation');
    