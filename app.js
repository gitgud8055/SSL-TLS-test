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
const {deleteFile} = require('./module/delete-uploaded')

app.use(parser.urlencoded({extended: true}));
app.use(parser.json());
app.use(session({
  secret: 'Welcome to a new 210 episode',
  resave: false,
  saveUninitialized: true
}));

app.use('/source', express.static('source'));
app.use('/views', express.static('views'));
app.use('/uf', express.static('user-file'))

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

app.post('/api/logout', function(req, res) {
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

app.get('/class', log_authorize, function(req, res) {
  try {
    if (req.session.authority === "student") {
      db.serialize(async function() {
        try {
          let data;
          await new Promise((res, rej) => {
            db.all(`select i.id, c.class_id as cid, c.class_name as cn, c.course_id as course, i.name, i.email from (select class_id, Tid from learn where id = ?) l 
            join class c on l.class_id = c.class_id join information i where i.id = l.Tid`, 
            [req.session.key], (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              data = rows;
              res();
            });
          });
          
          let waiting, pending;
          await new Promise((res, rej) => {
            db.all(`select idx from date_set where id_owner = ?`, [req.session.key], (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              waiting = Array.from(rows, (x) => x.idx);
              res();
            });
          });
          let user_pend;
          await new Promise((res, rej) => {
            db.all(`select * from date_target where id = ?`, [req.session.key], (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              user_pend = rows;
              pending = Array.from(rows, (x) => x.idx);
              res();
            });
          });
          let total = waiting.concat(pending);
          let date_info = {};
          await new Promise((res, rej) => {
            db.all(`select * from (select * from date_set where idx in (${total.map(() => '?').join(', ')})) ds 
            join (select id, name from information) i on ds.id_owner = i.id`, 
            total, (e, rows) => {
              if (e) {
                console.log(e.message);
                rej("Lỗi database");
              }
              rows.forEach((x) => {
                date_info[x.idx] = x;
              });
              res();
            });
          });
          await new Promise((res, rej) => {
            db.all(`select * from date_book where idx in (${total.map(() => '?').join(', ')})`,
            total, (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              rows.forEach((x) => {
                if (!('date' in date_info[x.idx])) {
                  date_info[x.idx].date = [];
                  date_info[x.idx].file = [];
                }
                date_info[x.idx].date.push([x.start, x.end, x.duration]);
              });
              res();
            });
          });
          await new Promise((res, rej) => {
            db.all(`select * from date_file where idx in (${total.map(() => '?').join(', ')})`,
            total, (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              rows.forEach((x) => {
                if (!('file' in date_info[x.idx])) {
                  date_info[x.idx].file = [];
                }
                date_info[x.idx].file.push([x.PathName, x.url]);
              });
              res();
            });
          });

          let user_wait;
          await new Promise((res, rej) => {
            db.all(`select * from (select * from date_target where idx in (${waiting.map(() => '?').join(', ')})) dt join (select id, name from information) i on dt.id = i.id`, waiting, (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              user_wait = rows;
              res();
            });
          });
          res.render(`${__dirname}/views/class-student.ejs`, {root: __dirname, link: `/source/image/${req.session.avatar}`, title: 'Danh sách',
          data: data, info: date_info, wait: user_wait, pend: user_pend});
        } catch (e) {
          console.log(e);
          res.status(504).json({message: e});
        }
      });
    }
    else if (req.session.authority === "teacher") {
      db.serialize(async function() {
        try {
          let data;
          await new Promise((res, rej) => {
            db.all(`select i.id, c.class_id as cid, c.class_name as cn, c.course_id as course, i.role, i.pos as position, i.name
            from (select class_id, id from learn where Tid = ?) t join class c on t.class_id = c.class_id join information i on i.id = t.id`, 
            [req.session.key], (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              data = rows;
              res();
            });
          });

          let waiting, pending;
          await new Promise((res, rej) => {
            db.all(`select idx from date_set where id_owner = ?`, [req.session.key], (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              waiting = Array.from(rows, (x) => x.idx);
              res();
            });
          });
          let user_pend;
          await new Promise((res, rej) => {
            db.all(`select * from date_target where id = ?`, [req.session.key], (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              user_pend = rows;
              pending = Array.from(rows, (x) => x.idx);
              res();
            });
          });
          let total = waiting.concat(pending);
          let date_info = {};
          await new Promise((res, rej) => {
            db.all(`select * from (select * from date_set where idx in (${total.map(() => '?').join(', ')})) ds 
            join (select id, name from information) i on ds.id_owner = i.id`, 
            total, (e, rows) => {
              if (e) {
                console.log(e.message);
                rej("Lỗi database");
              }
              rows.forEach((x) => {
                date_info[x.idx] = x;
              });
              res();
            });
          });
          await new Promise((res, rej) => {
            db.all(`select * from date_book where idx in (${total.map(() => '?').join(', ')})`,
            total, (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              rows.forEach((x) => {
                if (!('date' in date_info[x.idx])) {
                  date_info[x.idx].date = [];
                  date_info[x.idx].file = [];
                }
                date_info[x.idx].date.push([x.start, x.end, x.duration]);
              });
              res();
            });
          });
          await new Promise((res, rej) => {
            db.all(`select * from date_file where idx in (${total.map(() => '?').join(', ')})`,
            total, (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              rows.forEach((x) => {
                if (!('file' in date_info[x.idx])) {
                  date_info[x.idx].file = [];
                }
                date_info[x.idx].file.push([x.PathName, x.url]);
              });
              res();
            });
          });

          let user_wait;
          await new Promise((res, rej) => {
            db.all(`select * from (select * from date_target where idx in (${waiting.map(() => '?').join(', ')})) dt join (select id, name from information) i on dt.id = i.id`, waiting, (e, rows) => {
              if (e) {
                console.error(e.message);
                rej("Lỗi database");
              }
              user_wait = rows;
              res();
            });
          });
          res.render(`${__dirname}/views/class-teacher.ejs`, {root: __dirname, link: `/source/image/${req.session.avatar}`, title: 'Danh sách',
          data: data, info: date_info, wait: user_wait, pend: user_pend});
        } catch (e) {
          console.log(e);
          res.status(504).json({message: e});
        }
      });
    }
    else if (req.session.authority === "admin") {
      db.serialize(async function() {
        try {
          let account;
          await new Promise((res, rej) => {
            db.all(`select * from ((select id, username, password, authority from account) a join information i on i.id = a.id)`, (e, rows) => {
              if (e) {
                console.error("select account");
                rej("Lỗi database");
              }
              account = rows;
              res();
            });
          });
          res.render(`${__dirname}/views/class-admin.ejs`, {root: __dirname, username: req.session.username, link: `/source/image/${req.session.avatar}`, title: 'Danh sách',
          account: account});
        }
        catch (e) {
          res.status(513).json({message: e});
        }
      });
    }
  }
  catch(e) {
    res.status(504).json({message: e.message});
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

app.post('/api/add-class', log_authorize, function(req, res, next) {
  if (authorize(req, res, ["admin"])) {
    return next();
  }
  return res.status(515).json({message: "Không có quyền"});
}, function(req, res) {
  if (!req.body || !req.body.data) {
    return res.status(515).json({message: "Thông tin bị thiếu hoặc không hợp lệ"});
  }
  const data = req.body.data;
  console.log(data);
  db.serialize(async function() {
    try {
      await new Promise((res, rej) => {
        db.run("begin transaction", (e) => {
          if (e) {
            console.error("begin ", e.message);
            rej("Lỗi database");
          }
          res();
        })
      });

      await new Promise((res, rej) => {
        db.all(`select * from class where class_id = ?`, [data[0]], (e, rows) => {
          if (e) {
            console.error("select class", e.message);
            rej("Lỗi database");
          }
          if (rows.length > 0) {
            rej("Lớp đã tồn tại");
          }
          res();
        });
      });

      await new Promise((res, rej) => {
        db.all(`select authority from account where id = ?`, [data[3]], (e, rows) => {
          if (e) {
            console.error("select account", e.message);
            return rej("Lỗi database");
          }
          if (rows.length !== 1) {
            return rej("Không tồn tại giảng viên này");
          }
          if (rows[0].authority !== "teacher") {
            return rej("ID này không thuộc về giảng viên");
          }
          res();
        });
      });

      await new Promise((res, rej) => {
        db.run(`insert into class values (?, ?, ?)`, [data[0], data[1], data[2]], (e) => {
          if (e) {
            console.error("insert class", e.message);
            rej("Lỗi database");
          }
          res();
        });
      });

      await new Promise((res, rej) => {
        db.run(`insert into teach values (?, ?)`, [data[3], data[0]], (e) => {
          if (e) {
            console.error("insert class", e.message);
            rej("Lỗi database");
          }
          res();
        });
      });

      await new Promise((sol, rej) => {
        db.run("commit", (e) => {
          if (e) {
            console.error("commit ", e.message);
            rej("Lỗi database");
          }
        });
        sol();
      });
      res.json({message: "Success"});
    } 
    catch (e) {
      await new Promise((res, rej) => {
        db.run("rollback", (e) => {
          if (e) {
            console.error("rollback", e.message);
            rej("Lỗi database");
          }
          res();
        });
      });
      res.status(515).json({message: e});
    }
  });
});

app.post('/api/add-student', log_authorize, function(req, res, next) {
  if (authorize(req, res, ["teacher"])) {
    return next();
  }
  return res.status(516).json({message: "Không có quyền"});
}, uf.upload.single('file'), function(req, res) {
  const data = req.body;
  console.log(data, req.file);

  if (!data || (!req.file && (!data.id || !data.id_class))) {
    if (req.file) deleteFile([req.file]);
    return res.status(516).json({message: "Thiếu thông tin"});
  }

  let list_name = [];
  if (req.file) {
    try {
      if (!req.file.originalname.endsWith(".csv")) {
        throw new Error("Chỉ chấp nhận file csv");
      }

      const infor = fs.readFileSync(req.file.path, 'utf8').split('\n').map((v) => v.split(','));
      console.log(infor);
      const position = [];
      for (let x of ["MSSV", "classID"]) {
        let id = infor[0].findIndex(v => v === x);
        if (id !== -1) position.push(id);
        else {
          throw new Error("Thiếu thông tin cần thiết");
        }
      }

      let cur;
      for (let j = 1; j < infor.length; j++) {
        cur = [];
        for (let x of position) {
          if (x < infor[j].length) {
            cur.push(infor[j][x]);
          }
          else break;
        }
        if (cur.length === position.length) {
          list_name.push(cur);
        }
      }

      if (list_name.length === 0) {
        throw new Error("Không tồn tại MSSV hợp lệ");
      }
    } catch (e) {
      return res.status(515).json({message: e.message});
    } finally {
      deleteFile([req.file]);
    }
  }
  else {
    list_name.push([data.id, data.id_class]);
  }

  db.serialize(async function() {
    try {
      await new Promise((res, rej) => {
        db.run("begin transaction", (e) => {
          if (e) {
            console.error("begin ", e.message);
            rej("Lỗi database");
          }
          res();
        })
      });

      await new Promise((res, rej) => {
        db.all(`select id from account where id in (${list_name.map(v => '?').join(',')}) and authority = 'student'`, list_name.map(v => v[0]), (e, rows) => {
          if (e) {
            console.error("select account ", e.message);
            rej("Lỗi database");
          }
          let cur = new Set(rows.map(v => v.id));
          list_name = list_name.filter(v => cur.has(v[0]));
          if (rows.length === 0) {
            rej("Không tồn tại dữ liệu hợp lệ")
          }
          res();
        });
      });

      await new Promise((res, rej) => {
        db.all(`select class_id from class where class_id in (${list_name.map(v => '?').join(',')})`, list_name.map(v => v[1]), (e, rows) => {
          if (e) {
            console.error("select class ", e.message);
            rej("Lỗi database");
          }
          let cur = new Set(rows.map(v => v.class_id));
          list_name = list_name.filter(v => cur.has(v[1]));
          if (rows.length === 0) {
            rej("Không tồn tại dữ liệu hợp lệ")
          }
          res();
        });
      });

      await new Promise((res, rej) => {
        db.all(`select id from learn where Tid = ? and id in (${list_name.map(v => '?').join(',')})`, [req.session.key , ...list_name.map(v => v[0])], (e, rows) => {
          if (e) {
            console.error("select information2 ", e.message);
            rej("Lỗi database");
          }
          let cur = new Set(rows.map(v => v.id));
          list_name = list_name.filter(v => !cur.has(v[0]));
          if (list_name.length === 0) {
            rej("Không tồn tại dữ liệu hợp lệ")
          }
          res();
        });
      });

      await new Promise((res, rej) => {
        db.run(`insert into learn(id, Tid, class_id) values ${list_name.map(v => `(?, '${req.session.key}', ?)`).join(',') }`, list_name.flat(3), (e, rows) => {
          if (e) {
            console.error("insert ", e.message);
            rej("Lỗi database");
          }
          res();
        });
      });

      await new Promise((sol, rej) => {
        db.run("commit", (e) => {
          if (e) {
            console.error("commit ", e.message);
            rej("Lỗi database");
          }
        });
        sol();
      });

      res.json({message: "Success"});
    } catch (e) {
      await new Promise((res, rej) => {
        db.run("rollback", (e) => {
          if (e) {
            console.error("rollback", e.message);
            rej("Lỗi database");
          }
          res();
        });
      });
      res.status(516).json({message: e});
    }
  });
});

app.post('/api/change-note', log_authorize, uf.upload.none(), function(req, res) {
  const data = req.body;
  if (data.desc && data.id) {
    db.serialize(async function() {
      try {
        let owner;
        await new Promise((res, rej) => {
          db.all(`select * from date_set where idx = ?`, [data.id], (e, rows) => {
            if (e) {
              console.error("select ", e);
              rej("Lỗi database");
            }
            if (rows.length !== 1) {
              console.error("authority");
              rej("Không tồn tại lịch hẹn");
            }
            owner = rows[0].id_owner;
            res();
          });
        });
        await new Promise((res, rej) => {
          db.all(`select * from date_target where idx = ? and id = ?`, [data.id, data.user ? data.user : req.session.key], (e, rows) => {
            if (e) {
              console.error("select2 ", e);
              rej("Lỗi database");
            }
            if (rows.length !== 1) {
              console.error("authority2");
              rej("Không tồn tại lịch hẹn");
            }
            res();
          });
        });
        await new Promise((res, rej) => {
          db.run(`update date_target set ${data.user ? "note" : "noteTo"} = ? where idx = ? and id = ?`, [data.desc, data.id, data.user ? data.user : req.session.key], (e) => {
            if (e) {
              console.log("update", e);
              rej("Lỗi database");
            }
            res();
          });
        });
        res.json({message: "Success"});
      }
      catch (e) {
        res.status(512).json({message: e});
      }
    });
  }
  else {
    res.status(512).json({message: "Thông tin thiếu hoặc không hợp lệ"});
  }
});

app.get('/api/get-date', log_authorize, function(req, res){
  const data = req.query.id;
  db.serialize(async function() {
    try {
      await new Promise((res, rej) => {
        db.all(`select * from date_target where idx = ? and id = ?`, [data, req.session.key], (e, rows) => {
          if (e) {
            console.error("select ", e);
            rej("Lỗi database");
          }
          if (rows.length !== 1) {
            console.error("select ");
            rej("Không có quyền")
          }
          res();
        });
      });
      await new Promise((res, rej) => {
        db.all(`select start as st, end as ed, duration as dur from date_book where idx = ?`, [data], (e, rows) => {
          if (e) {
            console.error("select ", e);
            rej("Lỗi database");
          }
          res(rows);
        });
      })
      .then(data => {
        res.json(data);
      });
    }
    catch (e) {
      res.status(504).json({message: e});
    }
  });
});

function verify_date(s) {
  return !isNaN(Date.parse(s));
}

function diff(s, t) {
  return Date.parse(t) - Date.parse(s);
}

function shift(s, diff) {
  return (new Date(Date.parse(s) + diff * 60000 + 7 * 3600000)).toISOString().slice(0, 16);
}

app.post('/api/set-user-date', log_authorize, uf.upload.none(), function(req, res) {
  const data = req.body;
  console.log(data);
  if (!(data.id && data.date)) {
    return res.status(509).json({message: "Dữ liệu đầu vào bị thiếu"});
  }
  if (!verify_date(data.date)) {
    return res.status(509).json({message: "Thời gian không hợp lệ"});
  }
  db.serialize(async function() {
    try {
      await new Promise((res, rej) => {
        db.all(`select * from date_target where idx = ? and id = ?`, [data.id, req.session.key], (e, rows) => {
          if (e) {
            console.error("select ", e);
            rej("Lỗi database");
          }
          if (rows.length !== 1) {
            console.error("select");
            rej("Không có quyền sửa đổi");
          }
          res();
        });
      });
      let dur;
      await new Promise((res, rej) => {
        db.all(`select * from date_book where idx = ?`, [data.id], (e, rows) => {
          if (e) {
            console.error("check ", e) ;
            rej("Lỗi database");
          }
          rows.forEach((x) => {
            console.log(x, data.date);
            if (x.start <= data.date && x.duration * 60000 <= diff(data.date, x.end) && diff(x.start, data.date) % (60000 * x.duration) === 0) {
              dur = x.duration;
              res();
            }
          });
          rej("Thời gian chọn không hợp lệ");
        });
      });
      await new Promise((res, rej) => {
        db.run(`update date_target set start = ?, end = ? where idx = ? and id = ?`, [data.date, shift(data.date, dur), data.id, req.session.key], (e) => {
          if (e) {
            console.error("update ", e);
            rej("Lỗi database");
          }
          res();
        });
      });
      res.json({message: "success"});
    }
    catch (e) {
      console.log(e);
      res.status(509).json({message: e});
    }
  });
});

app.post('/api/change-date', log_authorize, uf.upload.array('file-document'), function(req, res) {
  const data = req.body;
  // console.log(data);
  // console.log(req.files);
  if (data.desc && data.pl && data.pl.length > 0) {
    let id = data.pl[0];
    data.pl.shift();
    db.serialize(async function() {
      try {
        await new Promise((sol, rej) => {
          db.run("begin transaction", (e) => {
            if (e) {
              console.error("begin ", e.message);
              rej("Lỗi database");
            }
            sol();
          })
        });
        await new Promise((sol, rej) => {
          db.all("select * from date_set where idx = ? and id_owner = ?", [id, req.session.key], (e, rows) => {
            if (e) {
              console.error("verify ", e.message);
              rej("Lỗi database");
            }
            if (rows.length !== 1) {
              rej("Không có quyền sửa đổi thông tin");
            }
            sol();
          });
        });
        await new Promise((sol, rej) => {
          db.run("update date_set set note = ? where idx = ?", [data.desc, id], (e) => {
            if (e) {
              console.error("desc ", e.message);
              rej("Lỗi database");
            }
            sol();
          });
        });
        if (data.pl.length > 0) {
          await new Promise((res, rej) => {
            db.run(`delete from date_file where idx = ? and url in (${`?,`.repeat(data.pl.length).slice(0, -1)})`, [id].concat(data.pl), (e) => {
              if (e) {
                console.error("delete ", e.message);
                rej("Lỗi database");
              }
              res();
            });
          });
        }
        if (req.files.length > 0) {
          await new Promise((res, rej) => {
            db.run(`insert into date_file values ${`(${id}, ?, ?),`.repeat(req.files.length).slice(0, -1)}`, req.files.flatMap(x => [x.originalname, x.filename]), (e) => {
              if (e) {
                console.error("date_file", e.message);
                rej("Lỗi database");
              }
              res();
            });
          });
        }
        await new Promise((sol, rej) => {
          db.run("commit", (e) => {
            if (e) {
              console.error("commit ", e.message);
              rej("Lỗi database");
            }
          });
          sol();
        });
        res.json({message: "Success"});
      }
      catch (e) {
        deleteFile(req.files);
        await new Promise((res, rej) => {
          db.run("rollback", (e) => {
            if (e) {
              console.error("rollback", e.message);
              rej("Lỗi database");
            }
            res();
          });
        });
        res.status(510).json({message: e});
      }
    });
  }
  else {
    deleteFile(req.files);
    res.status(510).json({message: "Thông tin thiếu hoặc không hợp lệ"});
  }
});

app.post('/api/set-date', log_authorize, uf.upload.array('file-document'),function(req, res) {
   console.log(req.body);
   console.log(req.files);
  if (req.body.time && req.body.desc && req.body.target) {
    for (let i = 0; i < req.body.time.length; i += 2) {
      if (!(req.body.time[i] && req.body.time[i+1] && req.body.duration[i / 2] && req.body.duration[i/2] > 0 && diff(req.body.time[i], req.body.time[i + 1]) >= req.body.duration[i / 2] * 60000)) {
        req.body.time[i] = req.body.time[i+1] = req.body.duration[i/2] = '';
      }
    }
    req.body.time = req.body.time.filter(x => x);
    req.body.duration = req.body.duration.filter(x => x).map((x, i) => [req.body.time[2 * i], req.body.time[2 * i + 1], x]);
    console.log(req.body.duration);
    if (req.body.time.length === 0) {
      deleteFile(req.files);
      return res.status(508).json({message: "Không tồn tại thời gian hợp lệ"});
    }
    db.serialize(async function() {
      try {
        await new Promise((res, rej) => {
          db.run("begin transaction", (e) => {
            if (e) {
              console.error("begin transaction", e.message);
              rej("Lỗi database");
            }
            res();
          });
        });
        await new Promise((res, rej) => {
          db.run(`insert into date_set (id_owner, note) values(?, ?)`, [req.session.key, req.body.desc], (e) => {
            if (e) {
              console.error("date_set", e.message);
              rej("Lỗi database");
            }
            res();
          });
        });
        let id;
        await new Promise((res, rej) => {
          db.all(`select idx from date_set where idx = last_insert_rowid()`, (e, rows) => {
            if (e || rows.length !== 1) {
              rej("Lỗi database");
            }
            id = rows[0].idx;
            res();
          });
        });
        await new Promise((res, rej) => {
          db.run(`insert into date_target(idx, id) values ${`(${id}, ?),`.repeat(req.body.target.length).slice(0, -1)}`, req.body.target, (e) => {
            if (e) {
              console.error("date_target", e.message);
              rej("Lỗi database");
            }
            res();
          });
        });
        await new Promise((res, rej) => {
          db.run(`insert into date_book values ${`(${id}, ?, ?, ?),`.repeat(req.body.time.length/2).slice(0, -1)}`, req.body.duration.flat(3), (e) => {
            if (e) {
              console.error("date_book", e.message);
              rej("Lỗi database");
            }
            res();
          });
        });
        if (req.files.length > 0) {
          await new Promise((res, rej) => {
            db.run(`insert into date_file values ${`(${id}, ?, ?),`.repeat(req.files.length).slice(0, -1)}`, req.files.flatMap(x => [x.originalname, x.filename]), (e) => {
              if (e) {
                console.error("date_file", e.message);
                rej("Lỗi database");
              }
              res();
            });
          });
        }
        await new Promise((res, rej) => {
          db.run("commit", (e) => {
            if (e) {
              console.error("commit", e.message);
              rej("Lỗi database");
            }
            res();
          });
        });
        res.json({message: "Success"});
      }catch (e) {
        deleteFile(req.files);
        await new Promise((res, rej) => {
          db.run("rollback", (e) => {
            if (e) {
              console.error("rollback", e.message);
              rej("Lỗi database");
            }
            res();
          });
        });
        res.status(508).json({message: e});
      }
    });
  }
  else {
    deleteFile(req.files);
    res.status(508).json({message: "Thông tin thiếu hoặc không hợp lệ"});
  }
});

app.post('/api/book', function(req, res) {
  const data = req.body;
  try {
    new Promise(function(suc, rej) {
      db.all(`select * from calendar where id = ? and date like '%${data.year}-${data.month.toString().padStart(2, "0")}-%'`, [req.session.key],(err, rows) => {
        if (err) {
          rej(err.message);
        }
        rows.forEach(function(v) {
          v.date = v.date.split('-')[2];
        });
        res.json(rows);
        suc();
      });
    });
  } catch (err) {
    res.status(500).json({message: err});
  }
});

app.get('/api/book/:idx', log_authorize, function(req, res) {
  const data = req.params.idx;
  console.log(data);
  db.serialize(async function() {
    try {
      await new Promise((res, rej) => {
        db.all(`select id from calendar where mid = ?`, [data], (e, rows) => {
          if (e || rows.length !== 1 || rows[0].id !== req.session.key) {
            rej("Invalid");
          }
          res();
        });
      });
      await new Promise((suc, rej) => {
        db.all(`select pathname as name, url as path from filedata where id = ?`, [data], (e, rows) => {
          if (e) {
            console.error(e.message);
            rej("Lỗi database");
          }
          res.json({data: rows});
          suc();
        });
      });
    } catch (err) {
      res.status(507).json({message: err});
    }
  });
});

app.get('/api/download', log_authorize, function(req, res) {
  return res.download(`./user-file/${req.query.l}`, req.query.n);
  const data = req.params.url;
  const idx = req.query.id;
  db.serialize(async function() {
    try {
      await new Promise((res, rej) => {
        db.all(`select id from calendar where mid = ?`, [data.id], (e, rows) => {
          if (e || rows.length !== 1 || rows[0].id !== req.session.key) {
            console.error(e.message);
            rej("Invalid");
          }
          res();
        });
      });
      await new Promise((suc, rej) => {
        db.all(`select pathname as name, url as path from filedata where id = ?`, [data], (e, rows) => {
          if (e) {
            console.error(e.message);
            rej("Lỗi database");
          }
          res.json({data: rows});
          suc();
        });
      });
    } catch (err) {
      res.status(507).json({message: err});
    }
  });
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

app.post('/api/change-c', log_authorize, uf.upload.array('file-document'),function(req, res) {
  const data = req.body;
  console.log("backend",data);
  // console.log(req.files);
  if (data.cdate && data.stime && data.etime && data.desc) {
    if (data.stime > data.etime) {
      deleteFile(req.files);
      return res.status(506).json({message: "Thời điểm bắt đầu và kết thúc không hợp lệ"});
    }
    if (data.mid) {
      db.serialize(async function() {
        try {
          await new Promise((res, rej) => {
            db.run("begin transaction", (e) => {
              if (e) {
                console.error("begin transaction", e.message);
                rej("Lỗi database");
              }
              res();
            });
          });
          await new Promise((res, rej) => {
            db.run(`update calendar set date = ?, start = ?, end = ?, note = ? where mid = ?`, [data.cdate, data.stime, data.etime, data.desc, data.mid], (e) => {
              if (e) {
                rej("Lỗi database");
              }
              res();
            });
          });
          if (data.pl && data.pl.length > 0) {
            await new Promise((res, rej) => {
              db.run(`delete from filedata where id = ? and url in (${`?,`.repeat(data.pl.length).slice(0, -1)})`, [data.mid].concat(data.pl), (e) => {
                if (e) {
                  rej("Lỗi database");
                }
                res();
              });
            });
          }
          if (req.files.length > 0) {
            await new Promise((res, rej) => {
              db.run(`insert into filedata values ${`(${data.mid}, ?, ?),`.repeat(req.files.length).slice(0, -1)}`, req.files.flatMap(x => [x.originalname, x.filename]), (e) => {
                if (e) {
                  console.error(e.message);
                  rej("Lỗi database");
                }
                res();
              });
            });
          }
          await new Promise((res, rej) => {
            db.run("commit", (e) => {
              if (e) {
                console.error("commit", e.message);
                rej("Lỗi database");
              }
              res();
            });
          });
          res.json({message: "Success"});
        } catch (e) {
          deleteFile(req.files);
          await new Promise((res, rej) => {
            db.run("rollback", (e) => {
              if (e) {
                console.error("rollback", e.message);
                rej("Lỗi database");
              }
              res();
            });
          });
          res.status(506).json({message: e});
        }

      });
    } else {
      db.serialize(async function() {
        try {
          await new Promise((res, rej) => {
            db.run("begin transaction", (e) => {
              if (e) {
                console.error("begin transaction", e.message);
                rej("Lỗi database");
              }
              res();
            });
          });
          await new Promise((res, rej) => {
            db.run(`insert into calendar(id, date, start, end, note) values (?, ?, ?, ?, ?)`, [req.session.key, data.cdate, data.stime, data.etime, data.desc], (err) => {
              if (err) {
                console.error(err.message);
                rej("Lỗi database");
              }
              res();
            });
          });
          if (req.files.length > 0) {
            let idx;
            await new Promise((res, rej) => {
              db.all(`select mid from calendar where mid = last_insert_rowid()`, (e, rows) => {
                if (e || rows.length !== 1) {
                  console.error(e.message);
                  rej("Lỗi database 400");
                }
                idx = rows[0].Mid;
                res();
              });
            });
            console.log(idx);
            await new Promise((res, rej) => {
              db.run(`insert into filedata values ${`(${idx}, ?, ?),`.repeat(req.files.length).slice(0, -1)}`, req.files.flatMap(x => [x.originalname, x.filename]), (e) => {
                if (e) {
                  console.error(e.message);
                  rej("Lỗi database");
                }
                res();
              });
            });
          }
          await new Promise((res, rej) => {
            db.run("commit", (e) => {
              if (e) {
                console.error("commit", e.message);
                rej("Lỗi database");
              }
              res();
            });
          });
          res.json({message: "Success"});
        } catch (e) {
          deleteFile(req.files);
          await new Promise((res, rej) => {
            db.run("rollback", (e) => {
              if (e) {
                console.error("rollback", e.message);
                rej("Lỗi database");
              }
              res();
            });
          });
          res.status(506).json({message: e});
        }
      });
    }
  }
  else {
    deleteFile(req.files);
    return res.status(506).json({message: "Thông tin không hợp lệ"});
  }
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