const express = require('express');
const url = require('url');
const path = require('path');
const parser = require('body-parser');
const ejs = require('ejs');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const fs = require('fs');

const app = express();
const db = new sqlite3.Database('data.db');

const { spawnSync, spawn} = require('child_process');
const { error, log } = require('console');

const ui = require('./module/upload-image');
const uf = require('./module/upload-file');
const {deleteFile} = require('./module/delete-uploaded');

app.use(parser.urlencoded({extended: true}));
app.use(parser.json());
app.use(session({
  secret: 'Welcome to a new 210 episode',
  resave: false,
  saveUninitialized: true
}));

app.use('/source', express.static('source'));
app.use('/views', express.static('views'));
app.use('/generator', express.static('generator'));
app.use('/uf', express.static('user-file'));

const check_logged = (req) => {
  return req.session && req.session.logged;
}
const log_authorize = (req, res, next) => {
  if (check_logged(req)) {
    return next();
  }
  //res.render(`${__dirname}/views/login.ejs`, {root: __dirname});
  res.redirect('/login');
};

const authorize = (req, res, pos) => {
  return (pos.includes(req.session.authority));
};

app.get('/login', function(req, res) {
  if (!check_logged(req)) res.render(`${__dirname}/views/login.ejs`, {root: __dirname});
  else res.redirect('/');
});

app.get('/', log_authorize, function(req, res) {
  res.render(`${__dirname}/views/main.ejs`, {root: __dirname, title: "Trang chủ", link: `/source/image/${req.session.avatar}`});
});

app.get('/account', log_authorize, function(req, res) {
  try {
    db.all("select * from information where id = ?", [req.session.key], (e, rows) => {
      if (e || rows.length !== 1) {
        res.status(502).json({message: "Something went wrong"});
      }
      res.render(`${__dirname}/views/account-manage.ejs`, {root: __dirname, title: "Quản lý tài khoản", link: `/source/image/${req.session.avatar}`, username: req.session.username,
      name: rows[0].name, phone_number: rows[0].phone, id: rows[0].id, email: rows[0].email, role: rows[0].role, position: rows[0].pos});
    });
  }
  catch (e) {
    res.status(502).json({message: e.message});
  }
});

app.get('/account/:target', log_authorize, function(req, res) {
  const targetID = req.params.target;
  try {
    db.serialize(function() {
      let account;
      db.all(`select * from account where id = ?`, [targetID],(e, rows) => {
        if (e || rows.length !== 1) {
          res.status(503).json({message: "Không tồn tại user này"});
        }
        account = rows[0];
      });
      db.all(`select * from information where id = ?`, [targetID], (e, rows) => {
        if (e || rows.length !== 1) {
          res.status(503).json({message: "Something went wrong"});
        }
        res.render(`${__dirname}/views/account-info.ejs`, {root: __dirname, title: "", link: `/source/image/${account.avatar}`, username: account.username,
        name: rows[0].name, phone_number: rows[0].phone, id: rows[0].id, email: rows[0].email, role: rows[0].role, position: rows[0].pos});
      })
    });
  } catch (e) {
    res.status(503).json({message: e.message});
  }
}); 

app.post('/api/login', async function(req, res) {
  const data = req.body;
  try {
    db.serialize(function() {
      db.all("select * from (select * from account where username = ?) a join information i where a.id = i.id", [data.username], (e, rows) => {
        if (e || rows.length !== 1 || rows[0].password != data.password) {
          res.status(500).json({message: "Wrong username or password"});
        }
        else {
          //res.render(`${__dirname}/views/main.ejs`, {root: __dirname});
          req.session.logged = true;
          req.session.authority = rows[0].authority;
          req.session.username = rows[0].username;
          req.session.key = rows[0].id;
          req.session.avatar = rows[0].avatar;
          res.json('/');
        }
      });
    });
  }
  catch (e) {
    res.status(500).json({message: e.message});
  }
});

const KeyRSA = {};

app.post('/api/logout', function(req, res) {
  delete KeyRSA[req.session.key];
  req.session.destroy((err) => {
    if (err) {
      console.log(`Logout error: ${err.message}`);
    }
    res.json('/login');
  });
});

app.get('/api/account', log_authorize, function(req, res) {
  res.render(`${__dirname}/views/account.ejs`, {root: __dirname, username: req.session.username, link: `/source/image/${req.session.avatar}`});
});

app.post('/api/trade', log_authorize, async function(req, res) {
  const data = req.body;
  if (!data || !data.n || !data.e) {
    return res.status(500).json({message: "Thiếu thông tin"});
  }
  if (req.session.key in KeyRSA) {
    return res.status(500).json();
  }
  try {
    KeyRSA[req.session.key] = {send: data};
    await new Promise((res, rej) => {
      var runner = spawn('./generator/rsa_be');
      runner.stdin.write("create");
      runner.stdin.end();
      runner.stdout.on('data', (data) => {
        KeyRSA[req.session.key].rec = JSON.parse(data.toString());
        res();
      });
    });
    let infor;
    await new Promise(async (res, rej) => {
      var runner = spawn('./generator/rsa_be');
      runner.stdin.write("encrypt\n");
      runner.stdin.write(`${KeyRSA[req.session.key].send.e} ${KeyRSA[req.session.key].send.n}\n`);
      let x = JSON.stringify({n: KeyRSA[req.session.key].rec.n, e: KeyRSA[req.session.key].rec.e});
      console.log(x);
      runner.stdin.write(x);
      runner.stdin.end();
      runner.stdout.on('data', (data) => {
        infor = data.toString();
        console.log(infor);
        res();
      });
    });
    console.log(KeyRSA[req.session.key]);
    res.send(infor);
  }
  catch (e) {
    res.status(500).json({message: "Không hợp lệ"});
  }
});

app.post('/api/messages', log_authorize, async function(req, res) {
  if (!req.body) return res.status(404).json();
  const data = req.body.content;
  try {
    await new Promise(async (res, rej) => {
      var runner = spawn('./generator/rsa_be');
      runner.stdin.write("decrypt\n");
      runner.stdin.write(`${KeyRSA[req.session.key].rec.d} ${KeyRSA[req.session.key].rec.n}\n`);
      runner.stdin.write(data);
      runner.stdin.end();
      runner.stdout.on('data', (data) => {
        infor = data.toString();
        console.log(infor);
        res();
      });
    });
    res.json({message: "123"});
  } catch (e) {
    res.status(500).json({message: "Error"});
  }
});

app.post('/api/change-password', log_authorize, function(req, res, next) {
  if (authorize(req, res, ["admin"])) {
    return next();
  }
  return res.status(514).json({message: "Không có quyền"});
}, function(req, res) {
  const data = req.body;
  console.log(data);
  if (data.password && data.id) {
    db.run('update account set password = ? where id = ?', [data.password, data.id], (e) => {
      if (e) {
        res.status(514).json({message: "Lỗi database"});
      }
      else {
        res.json({message: "Success"});
      }
    });
  }
  else {
    res.status(514).json({message: "Thông tin bị thiếu"});
  }
});

app.get('/api/download', log_authorize, function(req, res) {
  return res.download(`./user-file/${req.query.l}`, req.query.n);
});

const convert = {'name': 'name', 'phone_number': 'phone', 'email': 'email', 'role': 'role', 'position': 'pos'};
app.post('/api/update-profile', log_authorize, ui.upload.single('image'),function(req, res, next) {
  console.log(req.body);
  const data = JSON.parse(req.body.data);
  for (const [key, value] of Object.entries(data)) {
    if (!(key in convert)) {
      delete data[key];
    }
  }
  db.serialize(function() {
    if (Object.keys(data).length > 0) {
      const command = `update information set ${Object.keys(data).map(v => ` ${convert[v]} = ?`)} where id = ${req.session.key}`;
      db.run(command, Object.values(data), function(err) {
        if (err) {
          console.log(err);
        }
      });
    }

    if (req.file) {
      db.run(`update account set avatar = ? where id = ${req.session.key}`, [req.file.filename], err => {
        if (err) {
          console.log(err);
        }
      });
      req.session.avatar = req.file.filename;
    }
  });
  res.json({message: "Success"});
});

app.post('/api/change-pass', log_authorize, function(req, res) {
  const data = req.body;
  if (!data['current'] || !data['new'] || !data['check']) {
    return res.status(505).json({message: "Đầu vào bị lỗi"});
  }
  if (data['new'] !== data['check']) {
    return res.status(505).json({message: "Mật khẩu mới không khớp"});
  }
  if (data['new'] === data['current']) {
    return res.status(505).json({message: "Mật khẩu mới phải khác mật khẩu cũ"});
  }
  db.serialize(async function() {
    try {
      await new Promise((res, rej) => {
        db.all(`select password from account where id = ?`, [req.session.key],(e, rows) => {
          if (e) {
            rej(e.message);
          }
          if (rows[0].password !== data['current']) {
            rej("Mật khẩu cũ không đúng");
          }
          res();
        });
      });
      await new Promise((res, rej) => {
        db.run(`update account set password = ? where id = ?`, [data['new'], req.session.key], (e) => {
          if (e) {
            reject(e.message);
          }
          res();
        });
      });
      res.json({message: "Success"});
    }
    catch (e) {
      res.status(505).json({message: e});
    }
  });
});

app.post('/api/search', async function(req, res) {
  const command = req.body.command;
  console.log(command);
  res.json(command);
}); 

var server = app.listen(5000, function() {
  const host = server.address().address;
  const port = server.address().port;
  console.log("Running at " + host + ":" + port);
})