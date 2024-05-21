const fs = require('fs');

module.exports.deleteFile = function(files) {
  files.forEach((item) => {
    fs.unlink(item.path, err => {
      if (err) {
        console.log("Error deleting: ", err);
      }
    });
  });
};