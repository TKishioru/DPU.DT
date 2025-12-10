const myRequest = (data, callback) =>{
const response = 10 + data;
const error = undefined;
const result = callback(error,response);
return result;
}
const myCallback = (error,res)=>{
if(error)
return 'You have got error';
else
return res;

}
const result = myRequest(5,myCallback);
console.log(result);