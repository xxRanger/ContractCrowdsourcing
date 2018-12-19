contract = require('./contract');
const now = require("performance-now");
const plotly = require('plotly')('xxRanger','0BQcpXpNKPHYYzEKlIst');
const fs = require('fs');

const task_id = 0;
const batch = 1000;    // how many transactions sent for one time
const round = 200;     // how many rounds for sending transactions
const graphXSeg = 200;   // how many xpoint in graph
const dataSize = 3000;  //bytes
const data = '0x'+genRandomString(dataSize*2);

// function register(uint task_id, uint batch)
// function submit(uint task_id,uint id,bytes data)
// function clean()

function testSequenceRegister() {
    cleanWrapper(()=>testAndDrawRegister(true,round,batch,graphXSeg,true,task_id, batch));
}

function testNonSequenceRegister() {
    cleanWrapper(()=>testAndDrawRegister(false,round,batch,graphXSeg,true,task_id, batch));
}

function testSequenceSubmit() {
    cleanWrapper(()=>testAndDrawRegister(false,1,batch,graphXSeg,false,task_id, batch)).then(()=>testAndDrawSubmit(true,round,batch,graphXSeg,true,task_id,data));
}

function testNonSequenceSubmit() {
    cleanWrapper(()=>testAndDrawRegister(false,1,batch,graphXSeg,false,task_id, batch)).then(()=>testAndDrawSubmit(false,round,batch,graphXSeg,true,task_id,data));
}

testSequenceSubmit();
// testSequenceRegister();

function cleanWrapper(func){
    return contract.clean().then(()=>func());
}

function genRandomString (size) {
    return [...Array(size)].map(()=>Math.floor(Math.random() * 10)).join('');
}

async function calFuncTime(func) {
    let start = now();
    try {
        await func();
    } catch (e) {
        console.log(e.message);
    }
    let end = now();
    return parseFloat((end-start).toFixed(4))/1000;
}

async function  testContractFunc(round,func,sequence=false) {
    let tArray=[];
    if(sequence) {
        time = 0
        for(let i=0;i<round;++i) {
            try {
                let t = await calFuncTime(func);
                time += t;
                console.log("Has finished "+(i+1) +" total runned time:"+ time+"s "+"single runned time: "+t+"s");
                tArray.push(t);
            } catch (e) {
                console.log("transaction fail");
            }
        }
    } else {
        tArray = Array.from(Array(round).keys())
            .map(async (_,i)=> {
                try {
                    return await calFuncTime(func);
                } catch (e) {
                    console.log(e.message);
                }
            });
    }
    tArray = await Promise.all(tArray);
    let totalTime = tArray.reduce((a,b)=>a+b);
    console.log("total Time: "+totalTime+" s");

    return tArray;
}

function drawPic (tArray, xSeg, save,kind) {
    let maxT = tArray.reduce((a,b)=>a>b?a:b);
    let minT = tArray.reduce((a,b)=>a<b?a:b);
    let space = (maxT-minT)/xSeg;
    let bucket = Array(xSeg).fill(0);
    console.log("max time:",maxT);
    console.log("min time:",minT);

    tArray.forEach((t)=>{
        let bucketNumber= Math.floor((t-minT)/space);
        ++bucket[bucketNumber];
    });

    bucket.forEach((v,i)=> bucket[i]= i==0? v:bucket[i-1]+v);
    bucket.forEach((v,i)=> bucket[i]/=tArray.length);

    let x = [...Array(xSeg)].map((_,i)=> minT+space*i);
    let y = bucket;

    let data = [{
        x: x,
        y: y,
        line: {shape: 'spline'},
        type: 'scatter'
    }];


    if(!save) return;

    // save data and draw
    //
    fs.writeFile('labdata/'+kind+"batch"+batch+"round"+round,JSON.stringify({
        x:x,
        y:y
    }),(err)=> {
        if(err) console.log(err.message)
    });

    var layout = {fileopt : "overwrite", filename : "simple-node-example"+kind};
    plotly.plot(data, layout, function (err, msg) {
        if (err) return console.log(err);
        console.log(msg);
    });
}

function testAndDrawRegister(sequence,round,batch,graphXSeg,save,...args) {
    return testContractFunc(round,
        ()=> Promise.all(
            Array.from(Array(batch).keys())
            .map(()=>contract.register(...args))),
        sequence
    ).then(tArray=>drawPic(tArray,graphXSeg,save,"register"));
}

function testAndDrawSubmit(sequence,round,batch,graphXSeg,save,...args) {
    return testContractFunc(round,
        ()=> Promise.all(
            Array.from(Array(batch).keys())
                .map((_,i)=>contract.submit(...args,i))),
        sequence
    ).then(tArray=>drawPic(tArray,graphXSeg,save,"submit"));
}

