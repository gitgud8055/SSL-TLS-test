const multer = require('multer');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, `./user-file/`);
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}${Math.random()}-${file.originalname}`);
  }
});
const upload = multer({storage: storage});

module.exports.upload = upload;