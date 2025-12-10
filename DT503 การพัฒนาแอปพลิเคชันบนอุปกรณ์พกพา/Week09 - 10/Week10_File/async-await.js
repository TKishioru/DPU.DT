const myAsyncFunc = async()=>{
    const result = await Promise.resolve('Async Function');
    console.log(result);
}
myAsyncFunc();
