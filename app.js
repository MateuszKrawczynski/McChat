let express = require('express');
let ws = require('ws');
let sqlite3 = require('sqlite3').verbose();
let os = require('os');
let db = new sqlite3.Database("database.db");
let socketServer = new ws.Server({port:8080});
let app = express();



require('events').EventEmitter.defaultMaxListeners = Infinity; 

const getServerIp = () => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
      for (const iface of networkInterfaces[interfaceName]) {
        // Check for IPv4 and ensure it's not an internal (127.0.0.1) address
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'IP not found';
  };


function escapeHtml(unsafe)
{
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;")
         .replace(".","");
         
 }


app.listen(80,"0.0.0.0",()=>{
    console.log("running");
});

app.set("view engine","ejs");

app.use("/public",express.static("public"));
app.use(express.urlencoded());

app.get("/" , (req,res) => {
    db.all("SELECT * FROM chats",(err,rows) => {
        var chats = [];
        rows.forEach((element) => {
            chats.push(element.name);
        });
        res.render("index",{chats: chats});
    });
    
    
});

app.get("/new",(req,res) => {
    res.render("new",{backend: ""});
});

app.post("/new",(req,res) => {
    db.all("SELECT * FROM chats WHERE name=?",[escapeHtml(req.body.chat_name)],(err,rows) => {
        if (rows.length > 0 ){
            res.render("new",{backend: "This server already exists"});
        }
        else{
            db.run("INSERT INTO chats VALUES (?)",[req.body.chat_name]);
            db.run(`CREATE TABLE ${escapeHtml(req.body.chat_name)} (msg)`);
            res.redirect("/");
        }
    });
    
});

app.get("/chat/:id",(req,res) => {
    socketServer.on('connection',(socket) => {
        db.all(`SELECT * FROM ${escapeHtml(req.params.id)} WHERE 1=1`,(err,rows) => {
            socket.send(JSON.stringify(rows));
        });
    });
    db.all("SELECT * FROM chats WHERE name=?",[req.params.id],(err,rows) => {
        if (rows.length <= 0){
            res.redirect(`/archive/${req.params.id}`);
        }
        else{
            res.render("view",{name: req.params.id , ip: getServerIp()});
        }
    });
   

});

app.post("/chat/:id",(req,res) => {
   db.run(`INSERT INTO ${escapeHtml(req.params.id)} VALUES (?)`,[req.body.msg]);
   db.all(`SELECT * FROM ${escapeHtml(req.params.id)} WHERE 1=1`,(err,rows) => {
    socketServer.clients.forEach((socket) => {
        socket.send(JSON.stringify(rows));
    });
   });
   res.redirect(`/chat/${req.params.id}`)

});

//404 page
app.use((req,res) => {
    res.send("<h1>404</h1>");
});