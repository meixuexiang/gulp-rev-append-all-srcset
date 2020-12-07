const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const map = require('event-stream').map;
const { PluginError } = require('gulp-util');

const FILE_DECL = /(templateUrl\:\x20*|href=|src=|url\()(['|"])([^\s>"']+?)\2/gi;
const FILE_DECL_SRCSET = /srcset=['"](?:([^"'\s,]+)\s*(?:\s+\d+[wx])(?:,\s*)?)+["']/gi;

function getDependencyPath(pathString, file, isNgRoute) {
  const normPath = path.normalize(pathString);
  return normPath.startsWith(path.sep) ? path.join(file.base, normPath) : path.resolve(path.dirname(file.path), isNgRoute ? '../' + normPath : normPath)
}

function getHexCode(dependencyPath) {
  try {
    const data = fs.readFileSync(dependencyPath);
    const hash = crypto.createHash('md5');
    hash.update(data.toString(), 'utf8');
    return hash.digest('hex');
  } catch (error) {
    return '';
  }
}

const revPlugin = function revPlugin() {
  return map(function (file, cb) {
    if (!file) {
      throw new PluginError('gulp-rev-append', 'Missing file option for gulp-rev-append.');
    }
    if (!file.contents) {
      throw new PluginError('gulp-rev-append', 'Missing file.contents required for modifying files using gulp-rev-append.');
    }
    const isNgRoute = file.path.includes('/app.js');
    const contents = file.contents.toString().replace(FILE_DECL, (txt, attr, quote, pathString) => {
      const dependencyPath = getDependencyPath(pathString, file, isNgRoute);
      const code = getHexCode(dependencyPath);
      return code ? `${attr}${quote}${pathString}?v=${code}${quote}` : txt;
    }).replace(FILE_DECL_SRCSET, (attrTxt) => {
      return 'srcset="' + attrTxt.slice('srcset="'.length, -1).trim().split(/\x20*,\x20*/).map((srcTxt) => {
        let [pathString, descriptor] = srcTxt.trim().split(/\x20+/);
        pathString = pathString.trim();
        descriptor = descriptor.trim();
        if (pathString && descriptor) {
          const dependencyPath = getDependencyPath(pathString, file, isNgRoute);
          const code = getHexCode(dependencyPath);
          if (code) {
            return `${pathString}?v=${code} ${descriptor}`;
          }
        }
        return srcTxt;
      }).join(', ') + '"';
    });
    file.contents = new Buffer(contents);
    cb(null, file);
  });
};

module.exports = revPlugin;
