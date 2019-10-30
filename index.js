const recursiveRead = require('recursive-readdir');
const path = require('path');
const VirtualModulePlugin = require('virtual-module-webpack-plugin');
const fs=require("fs");
let directory = __dirname;
let folder = false;
let allScoped = false;
let fileExtensions = "vue";
const createdFiles = [];

function VueBuilderPlugin(options) {
  if (path.isAbsolute(options.path)) {
    directory = options.path;
  } else {
    directory = path.resolve(path.join(__dirname, '..', '..', options.path || ''));
  }

  if (options.folder) {
    folder = true;
  }

  if (options.allScoped) {
    allScoped = true;
  }

  if (options.fileExtensions) {
    fileExtensions = options.fileExtensions;
  }
}

const buildVues = (callback, compiler) => {
  // eslint-disable-next-line no-console
  console.log('Building vue files');

  recursiveRead(directory, (err, files) => {
    if (err) {
      return callback(err);
    }

    const vues = {};
    const sources = {
      script: {},
      template: {},
      style: {},
      source:{}
    };

    const langCheck = (file, extension, type) => {

      //const length = -5 - extension.length;
      let fileExtensionsCheck = `.${fileExtensions}.${extension}`;
      if(fileExtensionsCheck.endsWith("."))
        fileExtensionsCheck = fileExtensionsCheck.substring(0,fileExtensionsCheck.length-1)
       
      const length = -1 * (fileExtensionsCheck.length);

      let scoped = false;
      let moduled = false;
      let fullName = file.substr(file.lastIndexOf('\\') + 1);
      let fileExtensionsName = fullName.length > 0 ? fullName.substr(fullName.indexOf('.') + 1) : null;
      //if (file.slice(length) === fileExtensionsCheck) {
      if (file.slice(length) === fileExtensionsCheck ||
      (type === 'style' && fileExtensionsName && fileExtensionsName.startsWith(fileExtensions) && fileExtensionsName.endsWith('.'+extension))) {
        // let name = file.slice(0, length);
        let name = file.slice(0, file.lastIndexOf(fileExtensionsName) - 1);
        if (type === 'style' && name.slice(-7) === '.scoped') {
          scoped = true;
          name = name.slice(0, -7);
        }

        if (type === 'style' && fileExtensionsName.indexOf('.moduled') > 0) {
          moduled = true;
        }

        if (type === 'style' && allScoped) {
          scoped = true;
        }

        vues[name] = true;
        if (type === 'style') {
          sources[type][name] = sources[type][name] || [];
          sources[type][name].push({
            file,
            lang: extension,
            moduled: moduled,
            scoped:scoped
          });

        }
        else {
          sources[type][name] = {
            file,
            lang: extension,
          };
        }


        // if (scoped) {
        //   sources.style[name].scoped = true;
        // }

        return true;
      }

      return false;
    };

    const singleVue = (name, dirname) => {
      let data = '';

      const script = sources.script[name];
      const style = sources.style[name];
      const template = sources.template[name];
      const source = sources.source[name];
      const relate = file => `.${path.sep}${path.relative(dirname, file)}`;

      if (script) {
        data += `<script src="${relate(script.file)}" lang="${script.lang}"></script>\n`;
      }

      

      if (template) {
        data += `<template src="${relate(template.file)}" lang="${template.lang}"></template>\n`;
      }
      if (style && Array.isArray(style)) {
        for (const sty of style) {
          data += `<style src="${relate(sty.file)}" lang="${sty.lang}"${sty.moduled ? ' module="local" ' : (sty.scoped ? ' scoped' : '')}></style>\n`;
        }
      }
      if(source){
        var sourceFile = fs.readFileSync(source.file);
        data += new String(sourceFile);
      }
      return data;
    };

    files.forEach((file) => {
      if (langCheck(file, '', 'source')) {
        return;
      }
      if (langCheck(file, 'html', 'template')) {
        return;
      }

      if (langCheck(file, 'js', 'script')) {
        return;
      }

      if (langCheck(file, 'css', 'style')) {
        return;
      }

      // HTML alternatives
      if (langCheck(file, 'jade', 'template')) {
        return;
      }

      if (langCheck(file, 'pug', 'template')) {
        return;
      }

      // JS alternatives
      if (langCheck(file, 'coffee', 'script')) {
        return;
      }

      if (langCheck(file, 'ts', 'script')) {
        return;
      }

      // CSS alternatives
      if (langCheck(file, 'sass', 'style')) {
        return;
      }

      if (langCheck(file, 'scss', 'style')) {
        return;
      }

      if (langCheck(file, 'less', 'style')) {
        return;
      }

      langCheck(file, 'styl', 'style');
    });

    Object.keys(vues).forEach((vue) => {
      let dest = vue;

      if (folder && path.basename(vue) === path.basename(path.dirname(vue))) {
        dest = path.dirname(vue);
      }

      if (sources.script[vue] || sources.style[vue] || sources.template[vue]) {
        const modulePath = `${dest}.${fileExtensions}`;
        const ctime = VirtualModulePlugin.statsDate();
        const contents = singleVue(vue, path.dirname(dest));
        const fs = (this && this.fileSystem) || compiler.inputFileSystem;

        createdFiles.push(modulePath);
        VirtualModulePlugin.populateFilesystem({
          fs, modulePath, contents, ctime,
        });
      }
    });

    return callback();
  });
};

VueBuilderPlugin.prototype.apply = (compiler) => {
  compiler.plugin('run', (compilation, callback) => buildVues(callback, compiler));
  compiler.plugin('watch-run', (compilation, callback) => buildVues(callback, compiler));

  compiler.plugin('after-compile', (compilation, callback) => {
    // eslint-disable-next-line no-param-reassign
    compilation.fileDependencies = Array.from(compilation.fileDependencies).filter((file) => {
      if (createdFiles.includes(file)) {
        return false;
      }

      return true;
    });

    callback();
  });
};

module.exports = VueBuilderPlugin;
